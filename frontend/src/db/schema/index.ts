import { relations, sql } from "drizzle-orm";
import {
  check,
  bigint,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const organizationRole = pgEnum("organization_role", [
  "owner",
  "admin",
  "member",
]);

export const auditEventType = pgEnum("audit_event_type", [
  "invitation_created",
  "invitation_revoked",
  "invitation_accepted",
  "member_role_changed",
  "member_removed",
  "ownership_transferred",
  "organization_updated",
  "customer_created",
  "customer_updated",
  "customer_deleted",
  "invoice_created",
  "invoice_updated",
  "invoice_sent",
  "invoice_cancelled",
  "invoice_deleted",
  "payment_recorded",
]);

export const customerStatus = pgEnum("customer_status", [
  "lead",
  "active",
  "inactive",
]);

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
]);

export const paymentMethod = pgEnum("payment_method", [
  "cash",
  "bank_transfer",
  "card",
  "check",
  "other",
]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    fullName: varchar("full_name", { length: 100 }),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "profiles_full_name_length",
      sql`${table.fullName} is null or char_length(${table.fullName}) between 1 and 100`,
    ),
  ],
).enableRLS();

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 63 }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("organizations_slug_unique").on(table.slug),
    index("organizations_created_by_idx").on(table.createdBy),
    check("organizations_name_length", sql`char_length(${table.name}) between 2 and 120`),
    check(
      "organizations_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
  ],
).enableRLS();

export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: organizationRole("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "organization_members_pkey",
      columns: [table.organizationId, table.userId],
    }),
    index("organization_members_user_id_idx").on(table.userId),
    index("organization_members_organization_role_idx").on(
      table.organizationId,
      table.role,
    ),
  ],
).enableRLS();

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: organizationRole("role").default("member").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => profiles.id, {
      onDelete: "restrict",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => profiles.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("organization_invitations_token_hash_unique").on(
      table.tokenHash,
    ),
    uniqueIndex("organization_invitations_active_email_unique")
      .on(table.organizationId, table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index("organization_invitations_organization_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("organization_invitations_email_idx").on(table.email),
    check(
      "organization_invitations_email_normalized",
      sql`${table.email} = lower(btrim(${table.email})) and char_length(${table.email}) between 3 and 320`,
    ),
    check(
      "organization_invitations_role_not_owner",
      sql`${table.role} in ('admin', 'member')`,
    ),
    check(
      "organization_invitations_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "organization_invitations_terminal_state",
      sql`not (${table.acceptedAt} is not null and ${table.revokedAt} is not null)`,
    ),
  ],
).enableRLS();

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").notNull(),
    eventType: auditEventType("event_type").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("audit_events_actor_idx").on(table.actorId),
  ],
).enableRLS();

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    company: varchar("company", { length: 160 }),
    address: text("address"),
    status: customerStatus("status").default("lead").notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("customers_organization_name_idx").on(
      table.organizationId,
      table.name,
    ),
    index("customers_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),
    index("customers_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("customers_organization_updated_idx").on(
      table.organizationId,
      table.updatedAt,
    ),
    unique("customers_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    check(
      "customers_name_length",
      sql`char_length(btrim(${table.name})) between 1 and 160`,
    ),
    check(
      "customers_email_length",
      sql`${table.email} is null or char_length(${table.email}) between 3 and 320`,
    ),
    check(
      "customers_phone_length",
      sql`${table.phone} is null or char_length(${table.phone}) between 3 and 32`,
    ),
    check(
      "customers_company_length",
      sql`${table.company} is null or char_length(${table.company}) between 1 and 160`,
    ),
    check(
      "customers_address_length",
      sql`${table.address} is null or char_length(${table.address}) <= 1000`,
    ),
    check(
      "customers_notes_length",
      sql`${table.notes} is null or char_length(${table.notes}) <= 5000`,
    ),
    check("customers_version_positive", sql`${table.version} > 0`),
  ],
).enableRLS();

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull(),
    invoiceNumber: varchar("invoice_number", { length: 64 }).notNull(),
    numberSequence: integer("number_sequence").notNull(),
    status: invoiceStatus("status").default("draft").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    discountMinor: bigint("discount_minor", { mode: "number" })
      .default(0)
      .notNull(),
    taxRateBps: integer("tax_rate_bps").default(0).notNull(),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" })
      .default(0)
      .notNull(),
    taxMinor: bigint("tax_minor", { mode: "number" }).default(0).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).default(0).notNull(),
    paidMinor: bigint("paid_minor", { mode: "number" }).default(0).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    version: integer("version").default(1).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("invoices_organization_number_unique").on(
      table.organizationId,
      table.invoiceNumber,
    ),
    unique("invoices_organization_sequence_unique").on(
      table.organizationId,
      table.numberSequence,
    ),
    unique("invoices_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "invoices_customer_tenant_fk",
      columns: [table.organizationId, table.customerId],
      foreignColumns: [customers.organizationId, customers.id],
    }).onDelete("restrict"),
    index("invoices_organization_status_due_idx").on(
      table.organizationId,
      table.status,
      table.dueDate,
    ),
    index("invoices_organization_customer_idx").on(
      table.organizationId,
      table.customerId,
    ),
    index("invoices_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("invoices_organization_issue_date_idx").on(
      table.organizationId,
      table.issueDate,
    ),
    check("invoices_number_sequence_positive", sql`${table.numberSequence} > 0`),
    check("invoices_currency_format", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("invoices_due_date_valid", sql`${table.dueDate} >= ${table.issueDate}`),
    check("invoices_notes_length", sql`${table.notes} is null or char_length(${table.notes}) <= 5000`),
    check("invoices_discount_nonnegative", sql`${table.discountMinor} >= 0`),
    check("invoices_tax_rate_range", sql`${table.taxRateBps} between 0 and 10000`),
    check("invoices_subtotal_nonnegative", sql`${table.subtotalMinor} >= 0`),
    check("invoices_tax_nonnegative", sql`${table.taxMinor} >= 0`),
    check("invoices_total_nonnegative", sql`${table.totalMinor} >= 0`),
    check("invoices_paid_valid", sql`${table.paidMinor} between 0 and ${table.totalMinor}`),
    check("invoices_discount_not_above_subtotal", sql`${table.discountMinor} <= ${table.subtotalMinor}`),
    check("invoices_version_positive", sql`${table.version} > 0`),
  ],
).enableRLS();

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "invoice_items_invoice_tenant_fk",
      columns: [table.organizationId, table.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
    }).onDelete("cascade"),
    unique("invoice_items_invoice_position_unique").on(
      table.invoiceId,
      table.position,
    ),
    index("invoice_items_organization_invoice_idx").on(
      table.organizationId,
      table.invoiceId,
    ),
    check("invoice_items_description_length", sql`char_length(btrim(${table.description})) between 1 and 500`),
    check("invoice_items_quantity_range", sql`${table.quantity} between 1 and 1000000`),
    check("invoice_items_unit_price_range", sql`${table.unitPriceMinor} between 0 and 1000000000`),
    check("invoice_items_line_total_valid", sql`${table.lineTotalMinor} = ${table.quantity}::bigint * ${table.unitPriceMinor}`),
    check("invoice_items_position_positive", sql`${table.position} > 0`),
  ],
).enableRLS();

export const paymentRecords = pgTable(
  "payment_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    paymentDate: date("payment_date", { mode: "string" }).notNull(),
    method: paymentMethod("method").notNull(),
    reference: varchar("reference", { length: 160 }),
    notes: text("notes"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "payment_records_invoice_tenant_fk",
      columns: [table.organizationId, table.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
    }).onDelete("cascade"),
    unique("payment_records_organization_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("payment_records_invoice_date_idx").on(
      table.invoiceId,
      table.paymentDate,
      table.createdAt,
    ),
    index("payment_records_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("payment_records_organization_payment_date_idx").on(
      table.organizationId,
      table.paymentDate,
    ),
    check("payment_records_amount_positive", sql`${table.amountMinor} > 0`),
    check("payment_records_reference_length", sql`${table.reference} is null or char_length(${table.reference}) between 1 and 160`),
    check("payment_records_notes_length", sql`${table.notes} is null or char_length(${table.notes}) <= 2000`),
  ],
).enableRLS();

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey(),
    key: varchar("key", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    monthlyPriceMinor: bigint("monthly_price_minor", { mode: "number" })
      .notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    features: jsonb("features").$type<string[]>().default([]).notNull(),
    limits: jsonb("limits")
      .$type<{ maxCustomers: number | null; maxInvoices: number | null }>()
      .notNull(),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("subscription_plans_key_unique").on(table.key),
    index("subscription_plans_active_sort_idx").on(table.active, table.sortOrder),
    check("subscription_plans_key_format", sql`${table.key} ~ '^[a-z][a-z0-9_]*$'`),
    check("subscription_plans_price_nonnegative", sql`${table.monthlyPriceMinor} >= 0`),
    check("subscription_plans_currency_format", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("subscription_plans_sort_positive", sql`${table.sortOrder} > 0`),
  ],
).enableRLS();

export const stripeCustomers = pgTable(
  "stripe_customers",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("stripe_customers_customer_unique").on(table.stripeCustomerId),
    unique("stripe_customers_organization_customer_unique").on(
      table.organizationId,
      table.stripeCustomerId,
    ),
    check("stripe_customers_id_format", sql`${table.stripeCustomerId} ~ '^cus_[A-Za-z0-9]+$'`),
  ],
).enableRLS();

export const organizationSubscriptions = pgTable(
  "organization_subscriptions",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 })
      .notNull(),
    stripePriceId: varchar("stripe_price_id", { length: 255 }).notNull(),
    status: subscriptionStatus("status").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    stripeEventCreatedAt: bigint("stripe_event_created_at", { mode: "number" })
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("organization_subscriptions_stripe_subscription_unique").on(
      table.stripeSubscriptionId,
    ),
    foreignKey({
      name: "organization_subscriptions_customer_mapping_fk",
      columns: [table.organizationId, table.stripeCustomerId],
      foreignColumns: [stripeCustomers.organizationId, stripeCustomers.stripeCustomerId],
    }).onDelete("cascade"),
    index("organization_subscriptions_status_idx").on(table.status),
    index("organization_subscriptions_customer_idx").on(table.stripeCustomerId),
    check("organization_subscriptions_customer_format", sql`${table.stripeCustomerId} ~ '^cus_[A-Za-z0-9]+$'`),
    check("organization_subscriptions_subscription_format", sql`${table.stripeSubscriptionId} ~ '^sub_[A-Za-z0-9]+$'`),
    check("organization_subscriptions_price_format", sql`${table.stripePriceId} ~ '^price_[A-Za-z0-9]+$'`),
    check("organization_subscriptions_event_created_nonnegative", sql`${table.stripeEventCreatedAt} >= 0`),
  ],
).enableRLS();

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    stripeEventId: varchar("stripe_event_id", { length: 255 }).primaryKey(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    payloadSha256: varchar("payload_sha256", { length: 64 }).notNull(),
    stripeCreatedAt: bigint("stripe_created_at", { mode: "number" }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("stripe_webhook_events_organization_processed_idx").on(
      table.organizationId,
      table.processedAt,
    ),
    check("stripe_webhook_events_id_format", sql`${table.stripeEventId} ~ '^evt_[A-Za-z0-9]+$'`),
    check("stripe_webhook_events_hash_format", sql`${table.payloadSha256} ~ '^[a-f0-9]{64}$'`),
    check("stripe_webhook_events_created_nonnegative", sql`${table.stripeCreatedAt} >= 0`),
  ],
).enableRLS();

export const profilesRelations = relations(profiles, ({ many }) => ({
  createdOrganizations: many(organizations),
  memberships: many(organizationMembers),
  sentInvitations: many(organizationInvitations, {
    relationName: "invitation_sender",
  }),
  createdCustomers: many(customers, { relationName: "customer_creator" }),
  updatedCustomers: many(customers, { relationName: "customer_updater" }),
  createdInvoices: many(invoices, { relationName: "invoice_creator" }),
  updatedInvoices: many(invoices, { relationName: "invoice_updater" }),
  recordedPayments: many(paymentRecords),
}));

export const organizationsRelations = relations(
  organizations,
  ({ one, many }) => ({
    creator: one(profiles, {
      fields: [organizations.createdBy],
      references: [profiles.id],
    }),
    members: many(organizationMembers),
    invitations: many(organizationInvitations),
    auditEvents: many(auditEvents),
    customers: many(customers),
    invoices: many(invoices),
    invoiceItems: many(invoiceItems),
    paymentRecords: many(paymentRecords),
    stripeCustomer: one(stripeCustomers),
    subscription: one(organizationSubscriptions),
    stripeWebhookEvents: many(stripeWebhookEvents),
  }),
);

export const organizationInvitationsRelations = relations(
  organizationInvitations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvitations.organizationId],
      references: [organizations.id],
    }),
    inviter: one(profiles, {
      fields: [organizationInvitations.invitedBy],
      references: [profiles.id],
      relationName: "invitation_sender",
    }),
  }),
);

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditEvents.organizationId],
    references: [organizations.id],
  }),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  organization: one(organizations, {
    fields: [customers.organizationId],
    references: [organizations.id],
  }),
  creator: one(profiles, {
    fields: [customers.createdBy],
    references: [profiles.id],
    relationName: "customer_creator",
  }),
  updater: one(profiles, {
    fields: [customers.updatedBy],
    references: [profiles.id],
    relationName: "customer_updater",
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  creator: one(profiles, {
    fields: [invoices.createdBy],
    references: [profiles.id],
    relationName: "invoice_creator",
  }),
  updater: one(profiles, {
    fields: [invoices.updatedBy],
    references: [profiles.id],
    relationName: "invoice_updater",
  }),
  items: many(invoiceItems),
  payments: many(paymentRecords),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  organization: one(organizations, {
    fields: [invoiceItems.organizationId],
    references: [organizations.id],
  }),
}));

export const paymentRecordsRelations = relations(paymentRecords, ({ one }) => ({
  invoice: one(invoices, {
    fields: [paymentRecords.invoiceId],
    references: [invoices.id],
  }),
  organization: one(organizations, {
    fields: [paymentRecords.organizationId],
    references: [organizations.id],
  }),
  recorder: one(profiles, {
    fields: [paymentRecords.recordedBy],
    references: [profiles.id],
  }),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(organizationSubscriptions),
}));

export const stripeCustomersRelations = relations(stripeCustomers, ({ one }) => ({
  organization: one(organizations, {
    fields: [stripeCustomers.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationSubscriptionsRelations = relations(
  organizationSubscriptions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSubscriptions.organizationId],
      references: [organizations.id],
    }),
    plan: one(subscriptionPlans, {
      fields: [organizationSubscriptions.planId],
      references: [subscriptionPlans.id],
    }),
  }),
);

export const stripeWebhookEventsRelations = relations(stripeWebhookEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [stripeWebhookEvents.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    profile: one(profiles, {
      fields: [organizationMembers.userId],
      references: [profiles.id],
    }),
  }),
);
