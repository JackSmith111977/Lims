import { describe, expect, it } from "vitest";

import { AdminApiError } from "@/lib/server/admin";
import { buildInventoryItemPayload, buildInventoryTransactionPayload } from "@/lib/server/inventory";

describe("inventory validation", () => {
  it("builds an item payload without allowing client-controlled balance", () => {
    expect(buildInventoryItemPayload({ itemCode: " R-001 ", type: " reagent ", name: " Buffer ", unit: " mL ", batchNo: " B-1 ", expiryDate: "2027-01-31" })).toEqual({
      item_code: "R-001",
      type: "reagent",
      name: "Buffer",
      unit: "mL",
      batch_no: "B-1",
      expiry_date: "2027-01-31",
    });
    expect(() => buildInventoryItemPayload({ itemCode: "R-001", type: "REAGENT", name: "Buffer", unit: "mL", quantity: 10 })).toThrowError(AdminApiError);
  });

  it("keeps item identity and system statuses protected on update", () => {
    expect(() => buildInventoryItemPayload({ itemCode: "R-002" }, true)).toThrowError(AdminApiError);
    expect(() => buildInventoryItemPayload({ status: "DEPLETED" }, true)).toThrowError(AdminApiError);
    expect(buildInventoryItemPayload({ location: "Cold room" }, true)).toEqual({ location: "Cold room" });
  });

  it("normalizes supported stock movements and rejects reserved fields", () => {
    expect(buildInventoryTransactionPayload({ transactionType: " inbound ", quantity: "10.25", remark: " received " })).toEqual({
      transaction_type: "INBOUND",
      quantity: 10.25,
      task_id: null,
      remark: "received",
    });
    expect(buildInventoryTransactionPayload({ transactionType: "OUTBOUND", quantity: 1, taskId: "42" })).toMatchObject({ transaction_type: "OUTBOUND", task_id: 42 });
    expect(() => buildInventoryTransactionPayload({ transactionType: "OUTBOUND", quantity: 0 })).toThrowError(AdminApiError);
    expect(() => buildInventoryTransactionPayload({ transactionType: "TRANSFER", quantity: 1 })).toThrowError(AdminApiError);
    expect(() => buildInventoryTransactionPayload({ transactionType: "RETURN", quantity: 1, taskId: 42 })).toThrowError(AdminApiError);
    expect(() => buildInventoryTransactionPayload({ transactionType: "SCRAP", quantity: 1.1234567 })).toThrowError(AdminApiError);
  });
});
