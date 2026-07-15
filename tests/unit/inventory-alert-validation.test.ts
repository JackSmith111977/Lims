import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildInventoryItemPayload, buildInventoryTransactionPayload } from "@/lib/server/inventory";

describe("inventory alert and task-link validation", () => {
  it("accepts a non-negative low-stock threshold without accepting quantity", () => {
    expect(buildInventoryItemPayload({ itemCode: "R-003", type: "REAGENT", name: "Buffer", unit: "mL", lowStockThreshold: "2.5" })).toMatchObject({ low_stock_threshold: 2.5 });
    expect(() => buildInventoryItemPayload({ itemCode: "R-003", type: "REAGENT", name: "Buffer", unit: "mL", lowStockThreshold: -1 })).toThrowError(AdminApiError);
    expect(() => buildInventoryItemPayload({ itemCode: "R-003", type: "REAGENT", name: "Buffer", unit: "mL", lowStockThreshold: 1.1234567 })).toThrowError(AdminApiError);
  });

  it("allows task association only for outbound usage", () => {
    expect(buildInventoryTransactionPayload({ transactionType: "OUTBOUND", quantity: 1, taskId: 12 })).toMatchObject({ task_id: 12 });
    expect(() => buildInventoryTransactionPayload({ transactionType: "INBOUND", quantity: 1, taskId: 12 })).toThrowError(AdminApiError);
    expect(() => buildInventoryTransactionPayload({ transactionType: "SCRAP", quantity: 1, taskId: 12 })).toThrowError(AdminApiError);
  });
});
