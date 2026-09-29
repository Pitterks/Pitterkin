import {
  pgTable, uuid, text, integer, timestamp, jsonb, pgEnum, index, uniqueIndex, boolean,
} from "drizzle-orm/pg-core";

export const inventoryStatus = pgEnum("inventory_status", [
  "available", "reserved", "sold", "replaced", "blocked",
]);
export const orderStatus = pgEnum("order_status", [
  "pending", "paid", "delivered", "expired", "refunded", "disputed",
]);
export const paymentStatus = pgEnum("payment_status", ["created", "paid", "failed", "expired"]);

/** Games are data, not code: a new game = a new row + attribute schema. */
export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // [{ key, label, type: "number" | "text" | "select" | "boolean", options? }]
  attributeSchema: jsonb("attribute_schema").$type<AttributeDef[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
});

export type AttributeDef = {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "boolean";
  options?: string[];
  filterable?: boolean;
};

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  attributes: jsonb("attributes").$type<Record<string, string | number | boolean>>().notNull().default({}),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  warrantyDays: integer("warranty_days").notNull().default(7),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("products_game_idx").on(t.gameId)]);

/** One row = one physical account. Credentials are AES-256-GCM encrypted. */
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id),
  credentialsEnc: text("credentials_enc").notNull(),
  status: inventoryStatus("status").notNull().default("available"),
  supplier: text("supplier"),
  costCents: integer("cost_cents"),
  reservedUntil: timestamp("reserved_until"),
  reservedByOrderId: uuid("reserved_by_order_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("inventory_product_status_idx").on(t.productId, t.status)]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  // secret in the order link; lets guests view delivery without an account
  accessToken: text("access_token").notNull(),
  status: orderStatus("status").notNull().default("pending"),
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
  deliveredAt: timestamp("delivered_at"),
}, (t) => [index("orders_email_idx").on(t.email)]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItems.id),
  priceCents: integer("price_cents").notNull(),
}, (t) => [index("order_items_order_idx").on(t.orderId)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  provider: text("provider").notNull(),
  externalId: text("external_id"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  status: paymentStatus("status").notNull().default("created"),
  rawEvents: jsonb("raw_events").$type<unknown[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("payments_provider_ext_uq").on(t.provider, t.externalId)]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
