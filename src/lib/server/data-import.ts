import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AdminApiError,
  recordAudit,
  requireId,
} from "@/lib/server/admin";
import {
  buildExperimentDataPayload,
  loadTaskData,
} from "@/lib/server/experiment-data";
import type { Database, Json } from "@/types/database";

export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 500;

type ImportField =
  | "sampleId"
  | "instrumentId"
  | "dataType"
  | "metricName"
  | "rawValue"
  | "processedValue"
  | "unit"
  | "sourceType"
  | "collectedAt"
  | "remark";

type ImportRow = {
  rowNumber: number;
  values: Record<string, unknown>;
};

const HEADER_ALIASES: Record<string, ImportField> = {
  sampleid: "sampleId",
  instrumentid: "instrumentId",
  datatype: "dataType",
  metricname: "metricName",
  rawvalue: "rawValue",
  processedvalue: "processedValue",
  unit: "unit",
  sourcetype: "sourceType",
  collectedat: "collectedAt",
  remark: "remark",
};

const REQUIRED_HEADERS: ImportField[] = [
  "sampleId",
  "dataType",
  "metricName",
  "rawValue",
  "processedValue",
  "collectedAt",
];

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      throw new AdminApiError(400, "IMPORT_ROW_INVALID", "导入文件不支持公式单元格。");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return value.result;
  }
  return value;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

async function loadWorksheet(fileName: string, buffer: Buffer) {
  const extension = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
  if (!extension || ![".csv", ".xlsx"].includes(extension)) {
    throw new AdminApiError(415, "IMPORT_FILE_TYPE_UNSUPPORTED", "仅支持 CSV 或 XLSX 文件。");
  }

  const workbook = new ExcelJS.Workbook();
  try {
    if (extension === ".csv") {
      const worksheet = await workbook.csv.read(Readable.from([buffer]), {
        parserOptions: { trim: true, ignoreEmpty: true },
      });
      return worksheet;
    }
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new AdminApiError(400, "IMPORT_FILE_INVALID", "文件无法解析为有效的 CSV 或 XLSX。");
  }

  const worksheets = workbook.worksheets.filter((worksheet) => worksheet.actualRowCount > 0);
  if (worksheets.length !== 1) {
    throw new AdminApiError(400, "IMPORT_SHEET_INVALID", "XLSX 文件必须只包含一个非空工作表。");
  }
  return worksheets[0];
}

export async function parseImportFile(fileName: string, buffer: Buffer): Promise<ImportRow[]> {
  if (buffer.byteLength > IMPORT_MAX_FILE_BYTES) {
    throw new AdminApiError(413, "IMPORT_FILE_TOO_LARGE", "导入文件不能超过 5 MiB。");
  }
  const worksheet = await loadWorksheet(fileName, buffer);
  if (!worksheet || worksheet.actualRowCount < 1) {
    throw new AdminApiError(400, "IMPORT_HEADERS_INVALID", "导入文件不能为空。");
  }

  const headerRow = worksheet.getRow(1);
  const headers = new Map<number, ImportField>();
  for (let column = 1; column <= headerRow.cellCount; column += 1) {
    const normalized = normalizeHeader(cellValue(headerRow.getCell(column)));
    if (!normalized) continue;
    const field = HEADER_ALIASES[normalized];
    if (!field || [...headers.values()].includes(field)) {
      throw new AdminApiError(400, "IMPORT_HEADERS_INVALID", "导入文件包含未知或重复列名。");
    }
    headers.set(column, field);
  }

  for (const required of REQUIRED_HEADERS) {
    if (![...headers.values()].includes(required)) {
      throw new AdminApiError(400, "IMPORT_HEADERS_INVALID", `导入文件缺少列：${required}。`);
    }
  }

  const rows: ImportRow[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: Record<string, unknown> = {};
    let rowHasData = false;
    for (const [column, field] of headers.entries()) {
      const value = cellValue(row.getCell(column));
      if (hasValue(value)) rowHasData = true;
      values[field] = value;
    }
    if (!rowHasData) continue;
    if (rows.length >= IMPORT_MAX_ROWS) {
      throw new AdminApiError(413, "IMPORT_ROW_LIMIT_EXCEEDED", "单个文件最多导入 500 条数据。");
    }
    rows.push({ rowNumber, values });
  }

  if (!rows.length) {
    throw new AdminApiError(400, "IMPORT_HEADERS_INVALID", "导入文件没有可导入的数据行。");
  }
  return rows;
}

function rowError(rowNumber: number, error: unknown): AdminApiError {
  const message = error instanceof AdminApiError ? error.message : "数据行校验失败。";
  return new AdminApiError(400, "IMPORT_ROW_INVALID", `第 ${rowNumber} 行无效：${message}`);
}

function safeFileName(fileName: string) {
  return (fileName.split(/[\\/]/).pop() || "upload").slice(0, 120);
}

export async function importTaskData(
  supabase: SupabaseClient<Database>,
  operatorId: string,
  taskIdValue: string,
  file: Blob & { name?: string },
) {
  const taskId = requireId(taskIdValue);
  const { data: task, error: taskError } = await supabase
    .from("experiment_task")
    .select("id, status")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError) throw new AdminApiError(500, "TASK_LOOKUP_FAILED", "无法读取实验任务。");
  if (!task) throw new AdminApiError(404, "TASK_NOT_FOUND", "实验任务不存在。");
  if (["APPROVED", "ARCHIVED"].includes(task.status)) {
    throw new AdminApiError(409, "DATA_TASK_LOCKED", "任务已审核或归档，不能导入实验数据。");
  }

  const fileName = safeFileName(file.name || "upload");
  const rows = await parseImportFile(fileName, Buffer.from(await file.arrayBuffer()));
  const payloads: Database["public"]["Tables"]["experiment_data"]["Insert"][] = [];
  const rowNumbers: number[] = [];

  for (const row of rows) {
    try {
      const payload = buildExperimentDataPayload({ ...row.values, sourceType: "FILE" });
      payloads.push({ ...payload, task_id: taskId, recorded_by: operatorId });
      rowNumbers.push(row.rowNumber);
    } catch (error) {
      throw rowError(row.rowNumber, error);
    }
  }

  const sampleIds = [...new Set(payloads.map((payload) => payload.sample_id).filter((id): id is number => typeof id === "number"))];
  const { data: links, error: linksError } = await supabase
    .from("task_sample")
    .select("sample_id")
    .eq("task_id", taskId)
    .in("sample_id", sampleIds);
  if (linksError) throw new AdminApiError(500, "DATA_REFERENCE_LOOKUP_FAILED", "无法验证任务样品关联。");
  const linkedSamples = new Set((links ?? []).map((link) => link.sample_id));
  for (let index = 0; index < payloads.length; index += 1) {
    const sampleId = payloads[index].sample_id;
    if (typeof sampleId !== "number" || !linkedSamples.has(sampleId)) {
      throw rowError(rowNumbers[index], new AdminApiError(400, "SAMPLE_NOT_LINKED_TO_TASK", "样品未关联到当前任务。"));
    }
  }

  const instrumentIds = [...new Set(payloads.map((payload) => payload.instrument_id).filter((id): id is number => typeof id === "number"))];
  if (instrumentIds.length) {
    const { data: instruments, error: instrumentError } = await supabase
      .from("instrument")
      .select("id, status")
      .in("id", instrumentIds);
    if (instrumentError) throw new AdminApiError(500, "DATA_REFERENCE_LOOKUP_FAILED", "无法验证实验设备。");
    const instrumentMap = new Map((instruments ?? []).map((instrument) => [instrument.id, instrument.status]));
    for (let index = 0; index < payloads.length; index += 1) {
      const instrumentId = payloads[index].instrument_id;
      if (typeof instrumentId === "number" && (!instrumentMap.has(instrumentId) || instrumentMap.get(instrumentId) === "SCRAPPED")) {
        throw rowError(rowNumbers[index], new AdminApiError(409, "INSTRUMENT_INVALID", "设备不存在或已报废。"));
      }
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("experiment_data")
    .insert(payloads)
    .select("id");
  if (insertError || !inserted) {
    if (insertError?.code === "23503") throw new AdminApiError(400, "INVALID_DATA_REFERENCE", "实验数据关联对象不存在。");
    if (insertError?.code === "23514") throw new AdminApiError(400, "INVALID_DATA_VALUE_SHAPE", "实验数据类型和值字段不匹配。");
    throw new AdminApiError(400, "DATA_IMPORT_FAILED", "实验数据导入失败。");
  }

  await recordAudit(
    supabase,
    "data.manage",
    "experiment_data_import",
    String(taskId),
    "IMPORT",
    null,
    {
      fileName,
      extension: fileName.slice(fileName.lastIndexOf(".")).toLowerCase(),
      importedCount: inserted.length,
    } as unknown as Json,
  );

  const importedIds = new Set(inserted.map((item) => item.id));
  const data = (await loadTaskData(supabase, String(taskId))).filter((item) => importedIds.has(item.id));
  return { data, importedCount: inserted.length };
}
