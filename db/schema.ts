import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  deviceKey: uuid("device_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  isBlocked: boolean("is_blocked").default(false).notNull(),
  riskScore: integer("risk_score").default(0).notNull(),
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
  qrFingerprint: text("qr_fingerprint"),
  qrImageHash: text("qr_image_hash"),
  isShared: boolean("is_shared").default(false).notNull(),
  reviewStatus: text("review_status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  reviewNote: text("review_note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lidlCardReports = pgTable("lidl_card_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  cardId: uuid("card_id").notNull().references(() => lidlCards.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  reason: text("reason", { enum: ["invalid_qr", "unrelated_image", "coupon_mismatch"] }).notNull(),
  status: text("status", { enum: ["open", "resolved"] }).default("open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("lidl_card_reports_open_idx").on(table.createdAt),
]);

export const userErrorReports = pgTable("user_error_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").references(() => profiles.id, { onDelete: "set null" }),
  category: text("category", { enum: ["screen", "access", "coupon", "other"] }).notNull(),
  message: text("message").notNull(),
  pagePath: text("page_path").notNull(),
  status: text("status", { enum: ["open", "resolved"] }).default("open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("user_error_reports_status_created_idx").on(table.status, table.createdAt),
  index("user_error_reports_reporter_idx").on(table.reporterId),
]);

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
  savedAmount: numeric("saved_amount", { precision: 12, scale: 4 }).default("0").notNull(),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
}, (table) => [
  index("coupon_use_events_used_by_used_at_idx").on(table.usedBy, table.usedAt),
]);

export const qrDailyUsage = pgTable("qr_daily_usage", {
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  usageDate: date("usage_date").notNull(),
  viewCount: smallint("view_count").default(0).notNull(),
  blockedAttempts: integer("blocked_attempts").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.profileId, table.usageDate] }),
]);

export const dunnesVouchers = pgTable("dunnes_vouchers", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  voucherType: text("voucher_type", { enum: ["5off25", "10off40", "10off50"] }).notNull(),
  barcode: text("barcode").notNull().unique(),
  imageData: text("image_data").notNull(),
  membershipRequired: boolean("membership_required").default(false).notNull(),
  membershipImageData: text("membership_image_data"),
  expiresOn: date("expires_on").notNull(),
  status: text("status", { enum: ["available", "reserved", "used", "expired", "rejected"] }).default("available").notNull(),
  reviewStatus: text("review_status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  reservedBy: uuid("reserved_by").references(() => profiles.id, { onDelete: "set null" }),
  reservedAt: timestamp("reserved_at", { withTimezone: true }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("dunnes_vouchers_status_expiry_idx").on(table.status, table.expiresOn),
  index("dunnes_vouchers_owner_idx").on(table.ownerId, table.createdAt),
  index("dunnes_vouchers_reserved_by_idx").on(table.reservedBy, table.reservedAt),
]);

export const dunnesVoucherReports = pgTable("dunnes_voucher_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  voucherId: uuid("voucher_id").notNull().references(() => dunnesVouchers.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  reason: text("reason", { enum: ["invalid_voucher", "membership_not_scanned"] }).notNull(),
  status: text("status", { enum: ["open", "resolved"] }).default("open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("dunnes_voucher_reports_open_idx").on(table.createdAt),
]);

export const dunnesVoucherActivity = pgTable("dunnes_voucher_activity", {
  id: uuid("id").defaultRandom().primaryKey(),
  voucherId: uuid("voucher_id").notNull().references(() => dunnesVouchers.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: ["viewed"] }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("dunnes_voucher_activity_daily_idx").on(table.eventType, table.occurredAt, table.profileId),
]);

export const dunnesDailyReservations = pgTable("dunnes_daily_reservations", {
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  usageDate: date("usage_date").notNull(),
  reservationCount: smallint("reservation_count").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.profileId, table.usageDate] }),
]);

export const apiRateLimits = pgTable("api_rate_limits", {
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  requestCount: integer("request_count").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.profileId, table.action, table.windowStart] }),
]);
