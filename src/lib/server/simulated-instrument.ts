import type { SupabaseClient } from "@supabase/supabase-js";

import { AdminApiError, requireId, requireObject } from "@/lib/server/admin";
import { createTaskData, type ExperimentDataView } from "@/lib/server/experiment-data";
import type { Database } from "@/types/database";

type SimulatedInstrumentPayload = {
  taskId: number;
  body: Record<string, unknown>;
};

export function buildSimulatedInstrumentPayload(bodyValue: unknown, instrumentIdValue: string): SimulatedInstrumentPayload {
  const body = requireObject(bodyValue);
  if (body.instrumentId !== undefined) {
    throw new AdminApiError(400, "INVALID_SIMULATOR_FIELD", "instrumentId 必须使用路径参数。");
  }
  if (body.sourceType !== undefined) {
    throw new AdminApiError(400, "INVALID_SIMULATOR_FIELD", "sourceType 由模拟接口服务端固定生成。");
  }
  if (body.taskId === undefined || body.taskId === null || body.taskId === "") {
    throw new AdminApiError(400, "SIMULATOR_TASK_REQUIRED", "taskId 不能为空。");
  }

  const { taskId, ...dataBody } = body;
  return {
    taskId: requireId(String(taskId)),
    body: {
      ...dataBody,
      instrumentId: requireId(instrumentIdValue),
      sourceType: "INSTRUMENT",
    },
  };
}

export async function createSimulatedInstrumentData(
  supabase: SupabaseClient<Database>,
  operatorId: string,
  instrumentIdValue: string,
  bodyValue: unknown,
): Promise<ExperimentDataView> {
  const instrumentId = requireId(instrumentIdValue);
  const { data: instrument, error } = await supabase
    .from("instrument")
    .select("id, status")
    .eq("id", instrumentId)
    .maybeSingle();

  if (error) throw new AdminApiError(500, "INSTRUMENT_LOOKUP_FAILED", "无法读取模拟仪器设备。");
  if (!instrument) throw new AdminApiError(404, "INSTRUMENT_NOT_FOUND", "模拟仪器设备不存在。");
  if (instrument.status === "SCRAPPED") {
    throw new AdminApiError(409, "INSTRUMENT_SCRAPPED", "已报废设备不能接收模拟数据。");
  }
  if (instrument.status !== "ACTIVE") {
    throw new AdminApiError(409, "INSTRUMENT_NOT_ACTIVE", "只有 ACTIVE 设备可以接收模拟数据。");
  }

  const { taskId, body } = buildSimulatedInstrumentPayload(bodyValue, String(instrumentId));
  return createTaskData(supabase, operatorId, String(taskId), body);
}
