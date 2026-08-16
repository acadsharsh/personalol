import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  numeric,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// scheduleBlocks — the master timetable template, seeded once from the JEE
// 2027 plan. One row per fixed time-block per weekday (mon..sun). Editable
// by the user from /schedule so the plan can flex without touching code.
// ---------------------------------------------------------------------------
export const scheduleBlocks = pgTable(
  "schedule_blocks",
  {
    id: serial("id").primaryKey(),
    weekday: varchar("weekday", { length: 3 }).notNull(), // mon,tue,wed,thu,fri,sat,sun
    orderIndex: integer("order_index").notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(), // "HH:MM"
    endTime: varchar("end_time", { length: 5 }).notNull(),
    activity: text("activity").notNull(),
    category: varchar("category", { length: 16 }).notNull(), // health|meal|break|study_11|study_12
    subject: varchar("subject", { length: 16 }), // physics|chemistry|maths|mixed|null
    grade: varchar("grade", { length: 2 }), // 11|12|null
    plannedMinutes: integer("planned_minutes").notNull(),
    isLecture: boolean("is_lecture").notNull().default(false),
  },
  (t) => [uniqueIndex("schedule_blocks_weekday_order_idx").on(t.weekday, t.orderIndex)],
);

// ---------------------------------------------------------------------------
// dailyLogs — one row per calendar date the user opens/logs.
// ---------------------------------------------------------------------------
export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: serial("id").primaryKey(),
    date: varchar("date", { length: 10 }).notNull(), // "YYYY-MM-DD"
    weekday: varchar("weekday", { length: 3 }).notNull(),
    wakeTime: varchar("wake_time", { length: 5 }),
    sleepHours: numeric("sleep_hours", { precision: 4, scale: 1 }),
    energy: integer("energy"), // 1-5
    mood: integer("mood"), // 1-5
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("daily_logs_date_idx").on(t.date)],
);

// ---------------------------------------------------------------------------
// blockLogs — per-block completion status for a given dailyLog.
// ---------------------------------------------------------------------------
export const blockLogs = pgTable(
  "block_logs",
  {
    id: serial("id").primaryKey(),
    dailyLogId: integer("daily_log_id").notNull(),
    scheduleBlockId: integer("schedule_block_id").notNull(),
    status: varchar("status", { length: 12 }).notNull().default("pending"), // pending|done|partial|skipped
    actualMinutes: integer("actual_minutes"),
    focus: integer("focus"), // 1-5 self-rated concentration
    note: text("note"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("block_logs_daily_block_idx").on(t.dailyLogId, t.scheduleBlockId)],
);

// ---------------------------------------------------------------------------
// mentorMessages — persisted AI mentor chat history.
// ---------------------------------------------------------------------------
export const mentorMessages = pgTable("mentor_messages", {
  id: serial("id").primaryKey(),
  role: varchar("role", { length: 10 }).notNull(), // user|assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
