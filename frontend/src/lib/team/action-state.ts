export type TeamActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

export const initialTeamActionState: TeamActionState = {
  message: "",
  status: "idle",
};
