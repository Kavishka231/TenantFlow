import { describe, expect, it } from "vitest";

import {
  createCustomerSchema,
  deleteCustomerSchema,
  updateCustomerSchema,
} from "./validation";

const validCustomer = {
  address: "  10 Main Street  ",
  company: "  Acme Ltd  ",
  email: "  CUSTOMER@Example.com ",
  name: "  Jane Customer  ",
  notes: "  Prefers email  ",
  organizationId: "00000000-0000-4000-8000-000000000001",
  phone: " +1 (555) 123-4567 ",
  status: "active",
};

describe("customer validation", () => {
  it("normalizes customer fields", () => {
    expect(createCustomerSchema.parse(validCustomer)).toMatchObject({
      address: "10 Main Street",
      company: "Acme Ltd",
      email: "customer@example.com",
      name: "Jane Customer",
      notes: "Prefers email",
      phone: "+1 (555) 123-4567",
      status: "active",
    });
  });

  it("turns blank optional fields into null", () => {
    const result = createCustomerSchema.parse({
      ...validCustomer,
      address: " ",
      company: "",
      email: " ",
      notes: "",
      phone: "",
    });

    expect(result).toMatchObject({
      address: null,
      company: null,
      email: null,
      notes: null,
      phone: null,
    });
  });

  it("rejects invalid contact data and status", () => {
    expect(
      createCustomerSchema.safeParse({
        ...validCustomer,
        email: "not-an-email",
        phone: "call me",
        status: "archived",
      }).success,
    ).toBe(false);
  });

  it("requires positive versions for updates and deletes", () => {
    const identity = {
      customerId: "00000000-0000-4000-8000-000000000002",
      organizationId: validCustomer.organizationId,
      version: "0",
    };

    expect(
      updateCustomerSchema.safeParse({ ...validCustomer, ...identity }).success,
    ).toBe(false);
    expect(deleteCustomerSchema.safeParse(identity).success).toBe(false);
  });
});
