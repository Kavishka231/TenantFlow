import { describe, expect, it } from "vitest";

import { roleHasPermission, rolesWithPermission } from "./permissions";

describe("organization role permissions", () => {
  it("allows every member to read their workspace", () => {
    expect(rolesWithPermission("read_workspace")).toEqual([
      "owner",
      "admin",
      "member",
    ]);
  });

  it("allows owners and admins to manage members", () => {
    expect(roleHasPermission("owner", "manage_members")).toBe(true);
    expect(roleHasPermission("admin", "manage_members")).toBe(true);
    expect(roleHasPermission("member", "manage_members")).toBe(false);
  });

  it("reserves organization deletion for owners", () => {
    expect(rolesWithPermission("delete_organization")).toEqual(["owner"]);
  });

  it("allows members to read customers but managers to mutate them", () => {
    expect(rolesWithPermission("read_customers")).toEqual([
      "owner",
      "admin",
      "member",
    ]);
    expect(rolesWithPermission("manage_customers")).toEqual([
      "owner",
      "admin",
    ]);
  });

  it("allows members to read invoices but only managers to mutate them", () => {
    expect(rolesWithPermission("read_invoices")).toEqual([
      "owner",
      "admin",
      "member",
    ]);
    expect(rolesWithPermission("manage_invoices")).toEqual([
      "owner",
      "admin",
    ]);
  });

  it("reserves subscription billing for owners", () => {
    expect(rolesWithPermission("read_billing")).toEqual(["owner"]);
    expect(rolesWithPermission("manage_billing")).toEqual(["owner"]);
  });

  it("allows every workspace role to read analytics", () => {
    expect(rolesWithPermission("read_analytics")).toEqual([
      "owner",
      "admin",
      "member",
    ]);
  });
});
