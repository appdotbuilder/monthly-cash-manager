import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  loginInputSchema,
  createMemberInputSchema,
  updateMemberInputSchema,
  recordPaymentInputSchema,
  updatePaymentInputSchema,
  getPaymentsByMonthInputSchema,
  getMemberPaymentHistoryInputSchema,
  sendNotificationInputSchema
} from './schema';

// Import handlers
import { authenticateUser, getCurrentUser } from './handlers/auth';
import { 
  getAllMembers, 
  getMemberById, 
  getMemberByUserId, 
  createMember, 
  updateMember, 
  deleteMember 
} from './handlers/members';
import { 
  getPaymentsByMonth, 
  getMemberPaymentHistory, 
  getCurrentMonthPayment, 
  recordPayment, 
  updatePayment, 
  getMembersWithOutstandingPayments 
} from './handlers/payments';
import { 
  sendWhatsAppNotifications, 
  getNotificationHistory, 
  getMemberNotifications 
} from './handlers/notifications';
import { getMemberDashboard, getAdminDashboard } from './handlers/dashboard';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => authenticateUser(input)),

  getCurrentUser: publicProcedure
    .input(loginInputSchema.pick({ email: true }))
    .query(({ input }) => getCurrentUser(0)), // TODO: Use actual user ID from context

  // Member management routes (Admin)
  getAllMembers: publicProcedure
    .query(() => getAllMembers()),

  getMemberById: publicProcedure
    .input(loginInputSchema.pick({ email: true }).extend({ id: loginInputSchema.shape.email.transform(() => 0) }))
    .query(({ input }) => getMemberById(0)), // TODO: Extract ID from input

  createMember: publicProcedure
    .input(createMemberInputSchema)
    .mutation(({ input }) => createMember(input)),

  updateMember: publicProcedure
    .input(updateMemberInputSchema)
    .mutation(({ input }) => updateMember(input)),

  deleteMember: publicProcedure
    .input(loginInputSchema.pick({ email: true }).extend({ id: loginInputSchema.shape.email.transform(() => 0) }))
    .mutation(({ input }) => deleteMember(0)), // TODO: Extract ID from input

  // Payment management routes
  getPaymentsByMonth: publicProcedure
    .input(getPaymentsByMonthInputSchema)
    .query(({ input }) => getPaymentsByMonth(input)),

  getMemberPaymentHistory: publicProcedure
    .input(getMemberPaymentHistoryInputSchema)
    .query(({ input }) => getMemberPaymentHistory(input)),

  getCurrentMonthPayment: publicProcedure
    .input(getMemberPaymentHistoryInputSchema)
    .query(({ input }) => getCurrentMonthPayment(input.member_id)),

  recordPayment: publicProcedure
    .input(recordPaymentInputSchema)
    .mutation(({ input }) => recordPayment(input, 0)), // TODO: Get admin user ID from context

  updatePayment: publicProcedure
    .input(updatePaymentInputSchema)
    .mutation(({ input }) => updatePayment(input, 0)), // TODO: Get admin user ID from context

  getMembersWithOutstandingPayments: publicProcedure
    .input(getPaymentsByMonthInputSchema)
    .query(({ input }) => getMembersWithOutstandingPayments(input.month)),

  // Notification routes (Admin)
  sendWhatsAppNotifications: publicProcedure
    .input(sendNotificationInputSchema)
    .mutation(({ input }) => sendWhatsAppNotifications(input, 0)), // TODO: Get admin user ID from context

  getNotificationHistory: publicProcedure
    .query(() => getNotificationHistory()),

  getMemberNotifications: publicProcedure
    .input(getMemberPaymentHistoryInputSchema)
    .query(({ input }) => getMemberNotifications(input.member_id)),

  // Dashboard routes
  getMemberDashboard: publicProcedure
    .input(getMemberPaymentHistoryInputSchema)
    .query(({ input }) => getMemberDashboard(input.member_id)),

  getAdminDashboard: publicProcedure
    .query(() => getAdminDashboard()),

  // Member-specific routes (for member dashboard)
  getMemberByUserId: publicProcedure
    .input(getMemberPaymentHistoryInputSchema.pick({ member_id: true }).extend({ user_id: getMemberPaymentHistoryInputSchema.shape.member_id }))
    .query(({ input }) => getMemberByUserId(input.user_id)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();