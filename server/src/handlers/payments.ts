import { db } from '../db';
import { paymentRecordsTable, membersTable } from '../db/schema';
import { 
    type PaymentRecord, 
    type RecordPaymentInput, 
    type UpdatePaymentInput, 
    type GetPaymentsByMonthInput,
    type GetMemberPaymentHistoryInput 
} from '../schema';
import { eq, and, desc, ne, or } from 'drizzle-orm';

// Get all payment records for a specific month (admin view)
export async function getPaymentsByMonth(input: GetPaymentsByMonthInput): Promise<PaymentRecord[]> {
    try {
        const results = await db.select()
            .from(paymentRecordsTable)
            .where(eq(paymentRecordsTable.month, input.month))
            .orderBy(desc(paymentRecordsTable.created_at))
            .execute();

        return results.map(record => ({
            ...record,
            amount_due: parseFloat(record.amount_due),
            amount_paid: parseFloat(record.amount_paid)
        }));
    } catch (error) {
        console.error('Failed to fetch payments by month:', error);
        throw error;
    }
}

// Get payment history for a specific member
export async function getMemberPaymentHistory(input: GetMemberPaymentHistoryInput): Promise<PaymentRecord[]> {
    try {
        const results = await db.select()
            .from(paymentRecordsTable)
            .where(eq(paymentRecordsTable.member_id, input.member_id))
            .orderBy(desc(paymentRecordsTable.year), desc(paymentRecordsTable.month_number))
            .execute();

        return results.map(record => ({
            ...record,
            amount_due: parseFloat(record.amount_due),
            amount_paid: parseFloat(record.amount_paid)
        }));
    } catch (error) {
        console.error('Failed to fetch member payment history:', error);
        throw error;
    }
}

// Get current month payment status for a member
export async function getCurrentMonthPayment(memberId: number): Promise<PaymentRecord | null> {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

        const results = await db.select()
            .from(paymentRecordsTable)
            .where(and(
                eq(paymentRecordsTable.member_id, memberId),
                eq(paymentRecordsTable.month, currentMonth)
            ))
            .execute();

        if (results.length === 0) {
            return null;
        }

        const record = results[0];
        return {
            ...record,
            amount_due: parseFloat(record.amount_due),
            amount_paid: parseFloat(record.amount_paid)
        };
    } catch (error) {
        console.error('Failed to fetch current month payment:', error);
        throw error;
    }
}

// Record a payment for a member (admin function)
export async function recordPayment(input: RecordPaymentInput, adminUserId: number): Promise<PaymentRecord> {
    try {
        // Verify member exists
        const memberExists = await db.select({ id: membersTable.id })
            .from(membersTable)
            .where(eq(membersTable.id, input.member_id))
            .execute();

        if (memberExists.length === 0) {
            throw new Error(`Member with ID ${input.member_id} not found`);
        }

        // Calculate year and month number from month string
        const [year, monthStr] = input.month.split('-');
        const yearNum = parseInt(year);
        const monthNum = parseInt(monthStr);

        // Check if payment record already exists for this member and month
        const existingPayment = await db.select()
            .from(paymentRecordsTable)
            .where(and(
                eq(paymentRecordsTable.member_id, input.member_id),
                eq(paymentRecordsTable.month, input.month)
            ))
            .execute();

        if (existingPayment.length > 0) {
            throw new Error(`Payment record already exists for member ${input.member_id} for ${input.month}`);
        }

        // Insert new payment record
        const result = await db.insert(paymentRecordsTable)
            .values({
                member_id: input.member_id,
                month: input.month,
                year: yearNum,
                month_number: monthNum,
                amount_due: input.amount_due.toString(),
                amount_paid: input.amount_paid.toString(),
                status: input.status,
                payment_date: input.payment_date,
                recorded_by: adminUserId,
                notes: input.notes || null
            })
            .returning()
            .execute();

        const record = result[0];
        return {
            ...record,
            amount_due: parseFloat(record.amount_due),
            amount_paid: parseFloat(record.amount_paid)
        };
    } catch (error) {
        console.error('Payment recording failed:', error);
        throw error;
    }
}

// Update a payment record (admin function)
export async function updatePayment(input: UpdatePaymentInput, adminUserId: number): Promise<PaymentRecord | null> {
    try {
        // Check if payment record exists
        const existingPayment = await db.select()
            .from(paymentRecordsTable)
            .where(eq(paymentRecordsTable.id, input.id))
            .execute();

        if (existingPayment.length === 0) {
            return null;
        }

        // Prepare update values
        const updateValues: any = {
            updated_at: new Date()
        };

        if (input.amount_paid !== undefined) {
            updateValues.amount_paid = input.amount_paid.toString();
        }
        if (input.status !== undefined) {
            updateValues.status = input.status;
        }
        if (input.payment_date !== undefined) {
            updateValues.payment_date = input.payment_date;
        }
        if (input.notes !== undefined) {
            updateValues.notes = input.notes;
        }

        // Update the payment record
        const result = await db.update(paymentRecordsTable)
            .set(updateValues)
            .where(eq(paymentRecordsTable.id, input.id))
            .returning()
            .execute();

        const record = result[0];
        return {
            ...record,
            amount_due: parseFloat(record.amount_due),
            amount_paid: parseFloat(record.amount_paid)
        };
    } catch (error) {
        console.error('Payment update failed:', error);
        throw error;
    }
}

// Get members with outstanding payments for a specific month
export async function getMembersWithOutstandingPayments(month: string): Promise<(PaymentRecord & { member: any })[]> {
    try {
        const results = await db.select()
            .from(paymentRecordsTable)
            .innerJoin(membersTable, eq(paymentRecordsTable.member_id, membersTable.id))
            .where(and(
                eq(paymentRecordsTable.month, month),
                or(
                    eq(paymentRecordsTable.status, 'unpaid'),
                    eq(paymentRecordsTable.status, 'partial')
                )
            ))
            .execute();

        return results.map(result => ({
            ...result.payment_records,
            amount_due: parseFloat(result.payment_records.amount_due),
            amount_paid: parseFloat(result.payment_records.amount_paid),
            member: {
                ...result.members,
                cash_balance: parseFloat(result.members.cash_balance)
            }
        }));
    } catch (error) {
        console.error('Failed to fetch members with outstanding payments:', error);
        throw error;
    }
}