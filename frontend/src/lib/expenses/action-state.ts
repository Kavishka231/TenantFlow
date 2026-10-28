export type ExpenseActionState = { message?: string; status: "idle" | "error" };
export const initialExpenseActionState: ExpenseActionState = { status: "idle" };
