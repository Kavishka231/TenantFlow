export type AuthActionState = {
  message: string;
  status: "error" | "success" | "idle";
};

export const initialAuthState: AuthActionState = {
  message: "",
  status: "idle",
};
