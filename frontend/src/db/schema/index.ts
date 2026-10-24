import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
]);

export const customerStatus = pgEnum("customer_status", [
  "lead",
  "active",
  "inactive",
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

export const profilesRelations = relations(profiles, ({ many }) => ({
  createdOrganizations: many(organizations),
  memberships: many(organizationMembers),
  sentInvitations: many(organizationInvitations, {
    relationName: "invitation_sender",
  }),
  createdCustomers: many(customers, { relationName: "customer_creator" }),
  updatedCustomers: many(customers, { relationName: "customer_updater" }),
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
