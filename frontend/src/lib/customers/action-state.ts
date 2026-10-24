export type CustomerActionState = {
  message: string;
  status: "idle" | "error";
};

export const initialCustomerActionState: CustomerActionState = {
  message: "",
  status: "idle",
};
