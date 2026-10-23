import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
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

export const profilesRelations = relations(profiles, ({ many }) => ({
  createdOrganizations: many(organizations),
  memberships: many(organizationMembers),
  sentInvitations: many(organizationInvitations, {
    relationName: "invitation_sender",
  }),
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
