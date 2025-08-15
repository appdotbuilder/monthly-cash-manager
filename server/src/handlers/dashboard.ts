import { db } from '../db';
import { membersTable, paymentRecordsTable } from '../db/schema';
import { 
    type MemberDashboard, 
    type AdminDashboard 
} from '../schema';
import { eq, desc, count, sum, and, sql } from 'drizzle-orm';

// Get dashboard data for members
export async function getMemberDashboard(memberId: number): Promise<MemberDashboard | null> {
    try {
        // Get member profile information
        const memberResults = await db.select()
            .from(membersTable)
            .where(eq(membersTable.id, memberId))
            .execute();

        if (memberResults.length === 0) {
            return null;
        }

        const member = {
            ...memberResults[0],
            cash_balance: parseFloat(memberResults[0].cash_balance)
        };

        // Get current month in YYYY-MM format
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

        // Get current month payment status
        const currentMonthPaymentResults = await db.select()
            .from(paymentRecordsTable)
            .where(
                and(
                    eq(paymentRecordsTable.member_id, memberId),
                    eq(paymentRecordsTable.month, currentMonth)
                )
            )
            .execute();

        const current_month_payment = currentMonthPaymentResults.length > 0 
            ? {
                ...currentMonthPaymentResults[0],
                amount_due: parseFloat(currentMonthPaymentResults[0].amount_due),
                amount_paid: parseFloat(currentMonthPaymentResults[0].amount_paid)
            }
            : null;

        // Get recent payment history (last 6 months)
        const recentPaymentResults = await db.select()
            .from(paymentRecordsTable)
            .where(eq(paymentRecordsTable.member_id, memberId))
            .orderBy(desc(paymentRecordsTable.year), desc(paymentRecordsTable.month_number))
            .limit(6)
            .execute();

        const recent_payments = recentPaymentResults.map(payment => ({
            ...payment,
            amount_due: parseFloat(payment.amount_due),
            amount_paid: parseFloat(payment.amount_paid)
        }));

        return {
            member,
            current_month_payment,
            recent_payments
        };
    } catch (error) {
        console.error('Get member dashboard failed:', error);
        throw error;
    }
}

// Get dashboard data for admin
export async function getAdminDashboard(): Promise<AdminDashboard> {
    try {
        // Get total number of members
        const totalMembersResult = await db.select({ count: count() })
            .from(membersTable)
            .execute();
        
        const total_members = totalMembersResult[0].count;

        // Get number of active members
        const activeMembersResult = await db.select({ count: count() })
            .from(membersTable)
            .where(eq(membersTable.status, 'active'))
            .execute();
        
        const active_members = activeMembersResult[0].count;

        // Get current month in YYYY-MM format
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

        // Get current month's total collections
        const currentMonthCollectionsResult = await db.select({ 
            total: sql<string>`COALESCE(${sum(paymentRecordsTable.amount_paid)}, '0')` 
        })
            .from(paymentRecordsTable)
            .where(eq(paymentRecordsTable.month, currentMonth))
            .execute();
        
        const current_month_collections = parseFloat(currentMonthCollectionsResult[0].total);

        // Get number of pending payments this month (unpaid or partial status)
        const pendingPaymentsResult = await db.select({ count: count() })
            .from(paymentRecordsTable)
            .where(
                and(
                    eq(paymentRecordsTable.month, currentMonth),
                    sql`${paymentRecordsTable.status} IN ('unpaid', 'partial')`
                )
            )
            .execute();
        
        const pending_payments = pendingPaymentsResult[0].count;

        // Get total cash balance across all members
        const totalCashBalanceResult = await db.select({ 
            total: sql<string>`COALESCE(${sum(membersTable.cash_balance)}, '0')` 
        })
            .from(membersTable)
            .execute();
        
        const total_cash_balance = parseFloat(totalCashBalanceResult[0].total);

        return {
            total_members,
            active_members,
            current_month_collections,
            pending_payments,
            total_cash_balance
        };
    } catch (error) {
        console.error('Get admin dashboard failed:', error);
        throw error;
    }
}