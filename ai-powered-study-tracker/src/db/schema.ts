import {
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** One row per IST calendar date — check-in fields + free notes. */
export const dayLogs = pgTable(
  "day_logs",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    wakeTime: text("wake_time"),
    sleepTime: text("sleep_time"),
    energy: integer("energy"), // 1..5
    mood: text("mood"), // emoji key
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("day_logs_date_key").on(t.date)]
);

export type DayLog = typeof dayLogs.$inferSelect;

/** Per-slot log for a day. status: done | partial | skipped */
export const slotLogs = pgTable(
  "slot_logs",
  {
    id: serial("id").primaryKey(),
    dayLogId: integer("day_log_id")
      .notNull()
      .references(() => dayLogs.id, { onDelete: "cascade" }),
    slotId: text("slot_id").notNull(),
    status: text("status").notNull().default("none"),
    minutes: integer("minutes"),
    notes: text("notes"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("slot_logs_day_slot_key").on(t.dayLogId, t.slotId)]
);

export type SlotLog = typeof slotLogs.$inferSelect;

/** Mentor conversation history (single-user personal tracker). */
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  provider: text("provider"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;

/** Generated AI reviews, keyed by kind + date. */
export const insights = pgTable(
  "insights",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // "daily" | "weekly"
    date: date("date").notNull(),
    content: text("content").notNull(),
    provider: text("provider"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("insights_kind_date_key").on(t.kind, t.date)]
);

export type Insight = typeof insights.$inferSelect;
