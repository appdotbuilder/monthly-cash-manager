import { serial, text, pgTable, timestamp, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum definitions
export const userRoleEnum = pgEnum('user_role', ['admin', 'member']);
export const memberStatusEnum = pgEnum('member_status', ['active', 'inactive', 'suspended']);
export const paymentStatusEnum = pgEnum('payment_status', ['paid', 'unpaid', 'partial']);
export const notificationTypeEnum = pgEnum('notification_type', ['payment_reminder', 'balance_info']);
export const notificationStatusEnum = pgEnum('notification_status', ['sent', 'failed']);

// Users table (for both admin and member authentication)
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Hashed password
  role: userRoleEnum('role').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Members table
export const membersTable = pgTable('members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull().unique(),
  status: memberStatusEnum('status').notNull().default('active'),
  cash_balance: numeric('cash_balance', { precision: 10, scale: 2 }).notNull().default('0'),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Payment records table
export const paymentRecordsTable = pgTable('payment_records', {
  id: serial('id').primaryKey(),
  member_id: integer('member_id').notNull().references(() => membersTable.id),
  month: text('month').notNull(), // Format: YYYY-MM
  year: integer('year').notNull(),
  month_number: integer('month_number').notNull(),
  amount_due: numeric('amount_due', { precision: 10, scale: 2 }).notNull(),
  amount_paid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull().default('0'),
  status: paymentStatusEnum('status').notNull().default('unpaid'),
  payment_date: timestamp('payment_date'), // Nullable - set when payment is made
  recorded_by: integer('recorded_by').notNull().references(() => usersTable.id),
  notes: text('notes'), // Nullable field for optional notes
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// WhatsApp notification log table
export const notificationLogsTable = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  member_id: integer('member_id').notNull().references(() => membersTable.id),
  type: notificationTypeEnum('type').notNull(),
  message: text('message').notNull(),
  sent_at: timestamp('sent_at').defaultNow().notNull(),
  sent_by: integer('sent_by').notNull().references(() => usersTable.id),
  status: notificationStatusEnum('status').notNull().default('sent'),
});

// Relations
export const usersRelations = relations(usersTable, ({ one, many }) => ({
  member: one(membersTable, {
    fields: [usersTable.id],
    references: [membersTable.user_id],
  }),
  recordedPayments: many(paymentRecordsTable, { relationName: 'recorded_by_user' }),
  sentNotifications: many(notificationLogsTable, { relationName: 'sent_by_user' }),
}));

export const membersRelations = relations(membersTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [membersTable.user_id],
    references: [usersTable.id],
  }),
  paymentRecords: many(paymentRecordsTable),
  notificationLogs: many(notificationLogsTable),
}));

export const paymentRecordsRelations = relations(paymentRecordsTable, ({ one }) => ({
  member: one(membersTable, {
    fields: [paymentRecordsTable.member_id],
    references: [membersTable.id],
  }),
  recordedBy: one(usersTable, {
    fields: [paymentRecordsTable.recorded_by],
    references: [usersTable.id],
    relationName: 'recorded_by_user',
  }),
}));

export const notificationLogsRelations = relations(notificationLogsTable, ({ one }) => ({
  member: one(membersTable, {
    fields: [notificationLogsTable.member_id],
    references: [membersTable.id],
  }),
  sentBy: one(usersTable, {
    fields: [notificationLogsTable.sent_by],
    references: [usersTable.id],
    relationName: 'sent_by_user',
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Member = typeof membersTable.$inferSelect;
export type NewMember = typeof membersTable.$inferInsert;

export type PaymentRecord = typeof paymentRecordsTable.$inferSelect;
export type NewPaymentRecord = typeof paymentRecordsTable.$inferInsert;

export type NotificationLog = typeof notificationLogsTable.$inferSelect;
export type NewNotificationLog = typeof notificationLogsTable.$inferInsert;

// Important: Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  members: membersTable,
  paymentRecords: paymentRecordsTable,
  notificationLogs: notificationLogsTable,
};