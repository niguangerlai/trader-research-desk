import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const researchWorkspaces = sqliteTable("research_workspaces", {
  ownerKey: text("owner_key").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const marketDiscoveryCache = sqliteTable("market_discovery_cache", {
  id: text("id").primaryKey(),
  periodKey: text("period_key").notNull(),
  symbol: text("symbol").notNull(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("market_discovery_period_idx").on(table.periodKey)]);
