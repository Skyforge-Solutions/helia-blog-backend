// Database schema definitions
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Blog table definition
export const blogs = pgTable("blogs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 100 }).notNull(),
  content: text("content").notNull(),
  summary: varchar("summary", { length: 200 }),
  authorName: varchar("author_name", { length: 50 }).notNull(),
  authorEmail: varchar("author_email", { length: 100 }).notNull(),
  status: varchar("status", { length: 10 }).notNull().default("pending"),
  views: integer("views").notNull().default(0),
  submissionDate: timestamp("submission_date", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  approvalDate: timestamp("approval_date", { withTimezone: true }),
  lastModified: timestamp("last_modified", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  ipAddress: text("ip_address").notNull(),
  adminIpAddress: text("admin_ip_address"), // Original IP address only accessible to admins
  adminNotes: text("admin_notes"),
});

// Admin table definition
export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: text("password").notNull(), // This should store a hashed password
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  lastLogin: timestamp("last_login", { withTimezone: true }),
});
 