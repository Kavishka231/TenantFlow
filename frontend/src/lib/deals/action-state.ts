export type DealActionState = { status: "idle" | "error"; message?: string };
export const initialDealActionState: DealActionState = { status: "idle" };
