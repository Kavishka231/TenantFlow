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

export const profilesRelations = relations(profiles, ({ many }) => ({
  createdOrganizations: many(organizations),
  memberships: many(organizationMembers),
}));

export const organizationsRelations = relations(
  organizations,
  ({ one, many }) => ({
    creator: one(profiles, {
      fields: [organizations.createdBy],
      references: [profiles.id],
    }),
    members: many(organizationMembers),
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
