import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AdminApiError,
  requireId,
  requireObject,
  requireText,
} from "@/lib/server/admin";
import type { Database, Json } from "@/types/database";

const RULE_TYPES = ["ROUND", "THRESHOLD"] as const;
const EXECUTION_MODES = ["MANUAL", "SIMULATED"] as const;
const PROCESSING_RUN_FIELDS = "id, task_id, rule_id, execution_mode, status, output_data_id, decision, explanation, error_code, error_message, executed_by, executed_at";

type RuleType = (typeof RULE_TYPES)[number];
type ExecutionMode = (typeof EXECUTION_MODES)[number];
type Decision = "PASS" | "FAIL" | "REVIEW";
type RuleRow = Database["public"]["Tables"]["experiment_processing_rule"]["Row"];
type RunRow = Database["public"]["Tables"]["experiment_processing_run"]["Row"];
type LineageRow = Database["public"]["Tables"]["experiment_data_lineage"]["Row"];
type DataRow = Database["public"]["Tables"]["experiment_data"]["Row"];

type RoundConfig = {
  scale: number;
  roundingMode: "HALF_UP";
};

type ThresholdConfig = {
  min: number;
  max: number;
  inclusiveMin: boolean;
  inclusiveMax: boolean;
};

type RuleConfig = RoundConfig | ThresholdConfig;

export type ProcessingRuleView = {
  id: number;
  ruleCode: string;
  name: string;
  version: string;
  ruleType: RuleType;
  config: RuleConfig;
  status: string;
};

export type ProcessingRunView = {
  id: number;
  taskId: number;
  ruleId: number;
  executionMode: ExecutionMode;
  status: string;
  outputDataId: number | null;
  decision: Decision | null;
  explanation: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  executedBy: string;
  executedAt: string;
  rule: ProcessingRuleView | null;
  lineage: Array<{
    id: number;
    sourceDataId: number;
    outputDataId: number;
    relationType: string;
  }>;
};

type ProcessingRequest = {
  ruleId: number;
  sourceDataIds: number[];
  executionMode: ExecutionMode;
};

type ProcessingOutcome = {
  outputType: "PROCESSED" | "RESULT";
  processedValue: number;
  status: "SUCCEEDED" | "FLAGGED";
  decision: Decision | null;
  explanation: string;
};

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRuleConfig(ruleType: RuleType, value: Json): RuleConfig {
  if (!isRecord(value)) {
    throw new AdminApiError(500, "INVALID_RULE_CONFIGURATION", "Persisted processing rule configuration is invalid.");
  }

  if (ruleType === "ROUND") {
    const scale = value.scale;
    const roundingMode = value.roundingMode;
    if (typeof scale !== "number" || !Number.isInteger(scale) || scale < 0 || scale > 8 || roundingMode !== "HALF_UP") {
      throw new AdminApiError(500, "INVALID_RULE_CONFIGURATION", "Persisted rounding rule configuration is invalid.");
    }
    return { scale, roundingMode };
  }

  const min = value.min;
  const max = value.max;
  const inclusiveMin = value.inclusiveMin;
  const inclusiveMax = value.inclusiveMax;
  if (
    typeof min !== "number" || !Number.isFinite(min)
    || typeof max !== "number" || !Number.isFinite(max)
    || min > max
    || typeof inclusiveMin !== "boolean"
    || typeof inclusiveMax !== "boolean"
  ) {
    throw new AdminApiError(500, "INVALID_RULE_CONFIGURATION", "Persisted threshold rule configuration is invalid.");
  }
  return { min, max, inclusiveMin, inclusiveMax };
}

function serializeRule(row: RuleRow): ProcessingRuleView {
  if (!RULE_TYPES.includes(row.rule_type as RuleType)) {
    throw new AdminApiError(500, "INVALID_RULE_CONFIGURATION", "Persisted processing rule type is invalid.");
  }
  return {
    id: row.id,
    ruleCode: row.rule_code,
    name: row.name,
    version: row.version,
    ruleType: row.rule_type as RuleType,
    config: parseRuleConfig(row.rule_type as RuleType, row.config),
    status: row.status,
  };
}

function parseExecutionMode(value: unknown): ExecutionMode {
  const executionMode = String(value ?? "").toUpperCase();
  if (!EXECUTION_MODES.includes(executionMode as ExecutionMode)) {
    throw new AdminApiError(400, "INVALID_EXECUTION_MODE", "executionMode must be MANUAL or SIMULATED.");
  }
  return executionMode as ExecutionMode;
}

function parseSourceDataIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1) {
    throw new AdminApiError(400, "INVALID_PROCESSING_INPUTS", "MVP processing accepts exactly one sourceDataId.");
  }
  const sourceDataIds = value.map((item) => {
    if (typeof item !== "string" && typeof item !== "number") {
      throw new AdminApiError(400, "INVALID_PROCESSING_INPUTS", "sourceDataIds must contain numeric IDs.");
    }
    return requireId(String(item));
  });
  return [...new Set(sourceDataIds)];
}

export function buildProcessingRequest(bodyValue: unknown): ProcessingRequest {
  const body = requireObject(bodyValue);
  for (const field of ["id", "runId", "executedBy", "executedAt", "outputDataId", "status", "decision", "processedValue"]) {
    if (body[field] !== undefined) {
      throw new AdminApiError(400, "INVALID_PROCESSING_FIELD", `${field} is generated by the server.`);
    }
  }
  return {
    ruleId: requireId(String(body.ruleId)),
    sourceDataIds: parseSourceDataIds(body.sourceDataIds),
    executionMode: parseExecutionMode(body.executionMode),
  };
}

function sourceValue(row: Pick<DataRow, "data_type" | "raw_value" | "processed_value">) {
  const value = row.data_type === "RAW" ? row.raw_value : row.processed_value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AdminApiError(422, "PROCESSING_INPUT_NOT_NUMERIC", "Selected source data does not contain a finite numeric value.");
  }
  return value;
}

function roundHalfUp(value: number, scale: number) {
  const factor = 10 ** scale;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor;
}

export function applyProcessingRule(rule: ProcessingRuleView, row: Pick<DataRow, "data_type" | "raw_value" | "processed_value">): ProcessingOutcome {
  const value = sourceValue(row);
  if (rule.ruleType === "ROUND") {
    const config = rule.config as RoundConfig;
    return {
      outputType: "PROCESSED",
      processedValue: roundHalfUp(value, config.scale),
      status: "SUCCEEDED",
      decision: "PASS",
      explanation: `Applied ${rule.ruleCode} version ${rule.version} using scale ${config.scale}.`,
    };
  }

  const config = rule.config as ThresholdConfig;
  const lowerPass = config.inclusiveMin ? value >= config.min : value > config.min;
  const upperPass = config.inclusiveMax ? value <= config.max : value < config.max;
  const passed = lowerPass && upperPass;
  return {
    outputType: "RESULT",
    processedValue: value,
    status: passed ? "SUCCEEDED" : "FLAGGED",
    decision: passed ? "PASS" : "FAIL",
    explanation: passed
      ? `Value satisfied ${rule.ruleCode} version ${rule.version}.`
      : `Value was outside the ${rule.ruleCode} version ${rule.version} threshold and requires attention.`,
  };
}

export async function loadProcessingRules(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("experiment_processing_rule")
    .select("id, rule_code, name, version, rule_type, config, status")
    .eq("status", "ACTIVE")
    .order("rule_code", { ascending: true })
    .order("version", { ascending: false });
  if (error) throw new AdminApiError(500, "PROCESSING_RULE_LOOKUP_FAILED", "Unable to load processing rules.");
  return (data ?? []).map((row) => serializeRule(row as RuleRow));
}

async function loadProcessingRun(supabase: SupabaseClient<Database>, taskId: number, runId: number): Promise<ProcessingRunView> {
  const [{ data: run, error: runError }, { data: lineage, error: lineageError }] = await Promise.all([
    supabase.from("experiment_processing_run").select(PROCESSING_RUN_FIELDS).eq("task_id", taskId).eq("id", runId).maybeSingle(),
    supabase.from("experiment_data_lineage").select("id, run_id, source_data_id, output_data_id, relation_type").eq("run_id", runId).order("id", { ascending: true }),
  ]);
  if (runError || lineageError) throw new AdminApiError(500, "PROCESSING_RUN_LOOKUP_FAILED", "Unable to load the processing run.");
  if (!run) throw new AdminApiError(404, "PROCESSING_RUN_NOT_FOUND", "Processing run was not found.");

  const { data: rule, error: ruleError } = await supabase
    .from("experiment_processing_rule")
    .select("id, rule_code, name, version, rule_type, config, status")
    .eq("id", run.rule_id)
    .maybeSingle();
  if (ruleError) throw new AdminApiError(500, "PROCESSING_RULE_LOOKUP_FAILED", "Unable to load the processing rule.");

  const runRow = run as unknown as RunRow;
  return {
    id: runRow.id,
    taskId: runRow.task_id,
    ruleId: runRow.rule_id,
    executionMode: runRow.execution_mode as ExecutionMode,
    status: runRow.status,
    outputDataId: runRow.output_data_id,
    decision: runRow.decision as Decision | null,
    explanation: runRow.explanation,
    errorCode: runRow.error_code,
    errorMessage: runRow.error_message,
    executedBy: runRow.executed_by,
    executedAt: runRow.executed_at,
    rule: rule ? serializeRule(rule as RuleRow) : null,
    lineage: ((lineage ?? []) as unknown as LineageRow[]).map((item) => ({
      id: item.id,
      sourceDataId: item.source_data_id,
      outputDataId: item.output_data_id,
      relationType: item.relation_type,
    })),
  };
}

export async function loadProcessingRuns(supabase: SupabaseClient<Database>, taskIdValue: string) {
  const taskId = requireId(taskIdValue);
  const { data, error } = await supabase
    .from("experiment_processing_run")
    .select(PROCESSING_RUN_FIELDS)
    .eq("task_id", taskId)
    .order("executed_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new AdminApiError(500, "PROCESSING_RUN_LOOKUP_FAILED", "Unable to load processing runs.");
  return Promise.all((data ?? []).map((row) => loadProcessingRun(supabase, taskId, (row as RunRow).id)));
}

function processingRpcError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (error.code === "42501") return new AdminApiError(403, "FORBIDDEN", "Processing permission was denied.");
  if (message.includes("does not accept processing data")) return new AdminApiError(409, "DATA_TASK_LOCKED", "Task does not accept new processing data.");
  if (message.includes("not active")) return new AdminApiError(400, "PROCESSING_RULE_INACTIVE", "Processing rule is not active.");
  if (message.includes("Source data does not belong")) return new AdminApiError(400, "INVALID_PROCESSING_INPUTS", "Source data does not belong to the task.");
  return new AdminApiError(422, "PROCESSING_FAILED", "Processing could not be completed.");
}

export async function processTaskData(supabase: SupabaseClient<Database>, taskIdValue: string, bodyValue: unknown) {
  const taskId = requireId(taskIdValue);
  const request = buildProcessingRequest(bodyValue);
  const [{ data: task, error: taskError }, { data: rule, error: ruleError }, { data: sourceRows, error: sourceError }] = await Promise.all([
    supabase.from("experiment_task").select("id, status").eq("id", taskId).maybeSingle(),
    supabase.from("experiment_processing_rule").select("id, rule_code, name, version, rule_type, config, status").eq("id", request.ruleId).eq("status", "ACTIVE").maybeSingle(),
    supabase.from("experiment_data").select("id, data_type, raw_value, processed_value").eq("task_id", taskId).in("id", request.sourceDataIds),
  ]);
  if (taskError || ruleError || sourceError) throw new AdminApiError(500, "PROCESSING_INPUT_LOOKUP_FAILED", "Unable to validate processing inputs.");
  if (!task) throw new AdminApiError(404, "TASK_NOT_FOUND", "Task was not found.");
  if (["APPROVED", "ARCHIVED"].includes(task.status)) throw new AdminApiError(409, "DATA_TASK_LOCKED", "Task does not accept new processing data.");
  if (!rule) throw new AdminApiError(400, "PROCESSING_RULE_INACTIVE", "Processing rule is not active.");
  if (!sourceRows || sourceRows.length !== request.sourceDataIds.length) throw new AdminApiError(400, "INVALID_PROCESSING_INPUTS", "Source data does not belong to the task.");

  const selectedRule = serializeRule(rule as RuleRow);
  let outcome: ProcessingOutcome;
  try {
    outcome = applyProcessingRule(selectedRule, sourceRows[0] as Pick<DataRow, "data_type" | "raw_value" | "processed_value">);
  } catch (error) {
    const failure = await supabase.rpc("record_experiment_processing_failure", {
      _task_id: taskId,
      _rule_id: selectedRule.id,
      _execution_mode: request.executionMode,
      _source_data_ids: request.sourceDataIds,
      _error_code: error instanceof AdminApiError ? error.code : "PROCESSING_EXECUTION_FAILED",
      _error_message: error instanceof Error ? error.message : "Processing execution failed.",
    });
    if (failure.error) throw processingRpcError(failure.error);
    const runId = Number((failure.data as { runId?: number } | null)?.runId);
    if (!Number.isSafeInteger(runId) || runId <= 0) throw new AdminApiError(500, "PROCESSING_RUN_LOOKUP_FAILED", "Processing failure was recorded without a valid run ID.");
    return { data: await loadProcessingRun(supabase, taskId, runId), status: 422 as const };
  }

  const result = await supabase.rpc("execute_experiment_processing", {
    _task_id: taskId,
    _rule_id: selectedRule.id,
    _execution_mode: request.executionMode,
    _source_data_ids: request.sourceDataIds,
    _output_type: outcome.outputType,
    _processed_value: outcome.processedValue,
    _decision: outcome.decision,
    _status: outcome.status,
    _explanation: requireText(outcome.explanation, "explanation", 4000),
  });
  if (result.error) throw processingRpcError(result.error);
  const runId = Number((result.data as { runId?: number } | null)?.runId);
  if (!Number.isSafeInteger(runId) || runId <= 0) throw new AdminApiError(500, "PROCESSING_RUN_LOOKUP_FAILED", "Processing succeeded without a valid run ID.");
  return { data: await loadProcessingRun(supabase, taskId, runId), status: 201 as const };
}
