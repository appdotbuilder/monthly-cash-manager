import { z } from 'zod';

// User roles enum
export const userRoleSchema = z.enum(['admin', 'member']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User/Admin schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password: z.string(), // Hashed password
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Member status enum
export const memberStatusSchema = z.enum(['active', 'inactive', 'suspended']);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

// Member schema
export const memberSchema = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email(),
  status: memberStatusSchema,
  cash_balance: z.number(), // Current cash balance
  user_id: z.number(), // Foreign key to users table
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Member = z.infer<typeof memberSchema>;

// Payment status enum
export const paymentStatusSchema = z.enum(['paid', 'unpaid', 'partial']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

// Payment record schema
export const paymentRecordSchema = z.object({
  id: z.number(),
  member_id: z.number(),
  month: z.string(), // Format: YYYY-MM
  year: z.number(),
  month_number: z.number().int().min(1).max(12),
  amount_due: z.number(), // Expected payment amount
  amount_paid: z.number(), // Actual amount paid
  status: paymentStatusSchema,
  payment_date: z.coerce.date().nullable(), // When payment was made
  recorded_by: z.number(), // Admin user ID who recorded the payment
  notes: z.string().nullable(), // Optional notes
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

// WhatsApp notification log schema
export const notificationLogSchema = z.object({
  id: z.number(),
  member_id: z.number(),
  type: z.enum(['payment_reminder', 'balance_info']),
  message: z.string(),
  sent_at: z.coerce.date(),
  sent_by: z.number(), // Admin user ID who sent the notification
  status: z.enum(['sent', 'failed'])
});

export type NotificationLog = z.infer<typeof notificationLogSchema>;

// Input schemas for creating/updating data

// Login input schema
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Create member input schema
export const createMemberInputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email(),
  status: memberStatusSchema.default('active'),
  cash_balance: z.number().default(0),
  password: z.string().min(6) // Temporary password for member login
});

export type CreateMemberInput = z.infer<typeof createMemberInputSchema>;

// Update member input schema
export const updateMemberInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  status: memberStatusSchema.optional(),
  cash_balance: z.number().optional()
});

export type UpdateMemberInput = z.infer<typeof updateMemberInputSchema>;

// Record payment input schema
export const recordPaymentInputSchema = z.object({
  member_id: z.number(),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
  amount_due: z.number().positive(),
  amount_paid: z.number().nonnegative(),
  status: paymentStatusSchema,
  payment_date: z.coerce.date().nullable(),
  notes: z.string().nullable().optional()
});

export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;

// Update payment input schema
export const updatePaymentInputSchema = z.object({
  id: z.number(),
  amount_paid: z.number().nonnegative().optional(),
  status: paymentStatusSchema.optional(),
  payment_date: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional()
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentInputSchema>;

// Send notification input schema
export const sendNotificationInputSchema = z.object({
  member_ids: z.array(z.number()).min(1),
  type: z.enum(['payment_reminder', 'balance_info']),
  message: z.string().min(1)
});

export type SendNotificationInput = z.infer<typeof sendNotificationInputSchema>;

// Query input schemas

// Get payments by month input schema
export const getPaymentsByMonthInputSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
});

export type GetPaymentsByMonthInput = z.infer<typeof getPaymentsByMonthInputSchema>;

// Get member payment history input schema
export const getMemberPaymentHistoryInputSchema = z.object({
  member_id: z.number()
});

export type GetMemberPaymentHistoryInput = z.infer<typeof getMemberPaymentHistoryInputSchema>;

// Dashboard data schema for members
export const memberDashboardSchema = z.object({
  member: memberSchema,
  current_month_payment: paymentRecordSchema.nullable(),
  recent_payments: z.array(paymentRecordSchema)
});

export type MemberDashboard = z.infer<typeof memberDashboardSchema>;

// Admin dashboard data schema
export const adminDashboardSchema = z.object({
  total_members: z.number(),
  active_members: z.number(),
  current_month_collections: z.number(),
  pending_payments: z.number(),
  total_cash_balance: z.number()
});

export type AdminDashboard = z.infer<typeof adminDashboardSchema>;