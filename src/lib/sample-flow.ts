export const SAMPLE_FLOW_NODES = ["COLLECT", "DISTRIBUTE", "TRANSFER", "PROCESS", "ARCHIVE", "DISPOSE"] as const;

export type SampleFlowNode = (typeof SAMPLE_FLOW_NODES)[number];
