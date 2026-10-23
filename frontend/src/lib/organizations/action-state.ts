export type OrganizationActionState = {
  message: string;
  status: "error" | "idle";
};

export const initialOrganizationActionState: OrganizationActionState = {
  message: "",
  status: "idle",
};
