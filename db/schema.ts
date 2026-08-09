import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  deviceKey: uuid("device_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.groupId, table.profileId] }),
  index("group_members_profile_idx").on(table.profileId),
]);

export const lidlCards = pgTable("lidl_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }).unique(),
  qrObjectPath: text("qr_object_path"),
  isShared: boolean("is_shared").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  externalKey: text("external_key").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name"),
  label: text("label").notNull(),
  discountType: text("discount_type", { enum: ["fixed", "percent"] }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 4 }).notNull(),
  expiresText: text("expires_text").notNull(),
  maxUnits: integer("max_units").default(1).notNull(),
  keywords: jsonb("keywords").$type<string[]>().default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sourceCapturedAt: timestamp("source_captured_at", { withTimezone: true }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("coupons_owner_external_key_idx").on(table.ownerId, table.externalKey),
  index("coupons_owner_active_idx").on(table.ownerId, table.isActive),
  index("coupons_product_idx").on(table.productId),
]);

export const couponUseEvents = pgTable("coupon_use_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  couponId: uuid("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  usedBy: uuid("used_by").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  usedAt: timestamp("used_at", { withTimezone: true }).defaultNow().notNull(),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
});
