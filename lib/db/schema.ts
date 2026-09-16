import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  bodyJson: text("body_json", { mode: "json" }).notNull(),
  folderId: text("folder_id").references(() => folders.id, {
    onDelete: "cascade",
  }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const diagrams = sqliteTable("diagrams", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sceneJson: text("scene_json", { mode: "json" }).notNull(),
  noteId: text("note_id").references(() => notes.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const layouts = sqliteTable("layouts", {
  id: text("id").primaryKey(), // constant, e.g. "home"
  layoutJson: text("layout_json", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Finance data is cached locally from Plaid, which remains the system of record.
// Invariant S3: no column may hold a full account/card/routing number — `mask` is the only number-derived field.

export const plaidItems = sqliteTable("plaid_items", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull(),
  institutionName: text("institution_name").notNull(),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  status: text("status").$type<"healthy" | "needs_attention">().notNull(),
  lastErrorCode: text("last_error_code"),
  consentExpiresAt: integer("consent_expires_at", { mode: "timestamp" }),
  dirty: integer("dirty", { mode: "boolean" }).notNull().default(false),
  syncCursor: text("sync_cursor"),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const financialAccounts = sqliteTable(
  "financial_accounts",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => plaidItems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Plaid can omit/null mask, subtype, and balances.current for some
    // institutions and account types, so these stay nullable.
    mask: text("mask"),
    type: text("type").notNull(),
    subtype: text("subtype"),
    currentBalance: real("current_balance"),
    availableBalance: real("available_balance"),
    currencyCode: text("currency_code").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("financial_accounts_item_id").on(table.itemId)],
);

export const financialTransactions = sqliteTable(
  "financial_transactions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    date: text("date").notNull(),
    name: text("name").notNull(),
    pending: integer("pending", { mode: "boolean" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("financial_transactions_account_id_date").on(table.accountId, table.date)],
);

// Calendar events are not stored here — Google Calendar is the system of record.
