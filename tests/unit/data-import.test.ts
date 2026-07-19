import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { IMPORT_MAX_ROWS, parseImportFile } from "@/lib/server/data-import";

const headers = "sampleId,dataType,metricName,rawValue,processedValue,collectedAt,instrumentId,unit,remark";

describe("experiment data file import", () => {
  it("parses CSV aliases and preserves row numbers", async () => {
    const csv = `${headers}\n11,RAW,pH,7.2,,2026-07-15T08:00:00+08:00,5,pH,manual reading\n`;
    await expect(parseImportFile("observations.csv", Buffer.from(csv))).resolves.toEqual([
      {
        rowNumber: 2,
        values: {
          sampleId: 11,
          dataType: "RAW",
          metricName: "pH",
          rawValue: 7.2,
          processedValue: null,
          collectedAt: "2026-07-15T00:00:00.000Z",
          instrumentId: 5,
          unit: "pH",
          remark: "manual reading",
        },
      },
    ]);
  });

  it("parses an XLSX workbook", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("data");
    worksheet.addRow(headers.split(","));
    worksheet.addRow([11, "RAW", "pH", 7.2, null, "2026-07-15T08:00:00Z", null, "pH", "xlsx reading"]);
    const buffer = await workbook.xlsx.writeBuffer();

    const rows = await parseImportFile("observations.xlsx", Buffer.from(buffer as ArrayBuffer));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rowNumber: 2, values: { sampleId: 11, dataType: "RAW", rawValue: 7.2 } });
  });

  it("rejects unknown formats, missing headers and oversized row sets", async () => {
    await expect(parseImportFile("observations.xls", Buffer.from("content"))).rejects.toMatchObject({ code: "IMPORT_FILE_TYPE_UNSUPPORTED" } satisfies Partial<AdminApiError>);
    await expect(parseImportFile("observations.csv", Buffer.from("sampleId\n11\n"))).rejects.toMatchObject({ code: "IMPORT_HEADERS_INVALID" } satisfies Partial<AdminApiError>);

    const rows = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, index) => `11,RAW,pH,${index},,2026-07-15T08:00:00Z,,,`).join("\n");
    await expect(parseImportFile("observations.csv", Buffer.from(`${headers}\n${rows}`))).rejects.toMatchObject({ code: "IMPORT_ROW_LIMIT_EXCEEDED" } satisfies Partial<AdminApiError>);
  });
});
