import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, membersTable, paymentRecordsTable } from '../db/schema';
import { 
    getPaymentsByMonth, 
    getMemberPaymentHistory, 
    getCurrentMonthPayment, 
    recordPayment, 
    updatePayment, 
    getMembersWithOutstandingPayments 
} from '../handlers/payments';
import { 
    type GetPaymentsByMonthInput, 
    type GetMemberPaymentHistoryInput,
    type RecordPaymentInput,
    type UpdatePaymentInput 
} from '../schema';

describe('Payment Handlers', () => {
    let adminUserId: number;
    let memberUserId: number;
    let memberId: number;
    let paymentRecordId: number;

    beforeEach(async () => {
        await createDB();

        // Create admin user
        const adminUser = await db.insert(usersTable)
            .values({
                email: 'admin@test.com',
                password: 'hashedpassword',
                role: 'admin'
            })
            .returning()
            .execute();
        adminUserId = adminUser[0].id;

        // Create member user
        const memberUser = await db.insert(usersTable)
            .values({
                email: 'member@test.com',
                password: 'hashedpassword',
                role: 'member'
            })
            .returning()
            .execute();
        memberUserId = memberUser[0].id;

        // Create member
        const member = await db.insert(membersTable)
            .values({
                name: 'Test Member',
                phone: '1234567890',
                email: 'member@test.com',
                status: 'active',
                cash_balance: '100.00',
                user_id: memberUserId
            })
            .returning()
            .execute();
        memberId = member[0].id;
    });

    afterEach(resetDB);

    describe('getPaymentsByMonth', () => {
        it('should fetch payment records for a specific month', async () => {
            // Create test payment record
            const payment = await db.insert(paymentRecordsTable)
                .values({
                    member_id: memberId,
                    month: '2024-01',
                    year: 2024,
                    month_number: 1,
                    amount_due: '50.00',
                    amount_paid: '50.00',
                    status: 'paid',
                    payment_date: new Date(),
                    recorded_by: adminUserId,
                    notes: 'Test payment'
                })
                .returning()
                .execute();
            paymentRecordId = payment[0].id;

            const input: GetPaymentsByMonthInput = { month: '2024-01' };
            const result = await getPaymentsByMonth(input);

            expect(result).toHaveLength(1);
            expect(result[0].member_id).toBe(memberId);
            expect(result[0].month).toBe('2024-01');
            expect(result[0].amount_due).toBe(50);
            expect(result[0].amount_paid).toBe(50);
            expect(result[0].status).toBe('paid');
            expect(typeof result[0].amount_due).toBe('number');
            expect(typeof result[0].amount_paid).toBe('number');
        });

        it('should return empty array for month with no payments', async () => {
            const input: GetPaymentsByMonthInput = { month: '2024-12' };
            const result = await getPaymentsByMonth(input);

            expect(result).toHaveLength(0);
        });

        it('should order results by created_at descending', async () => {
            // Create first payment record
            const firstPayment = await db.insert(paymentRecordsTable)
                .values({
                    member_id: memberId,
                    month: '2024-01',
                    year: 2024,
                    month_number: 1,
                    amount_due: '50.00',
                    amount_paid: '25.00',
                    status: 'partial',
                    recorded_by: adminUserId
                })
                .returning()
                .execute();

            // Add a small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            // Create second payment record
            const secondPayment = await db.insert(paymentRecordsTable)
                .values({
                    member_id: memberId,
                    month: '2024-01',
                    year: 2024,
                    month_number: 1,
                    amount_due: '30.00',
                    amount_paid: '30.00',
                    status: 'paid',
                    recorded_by: adminUserId
                })
                .returning()
                .execute();

            const input: GetPaymentsByMonthInput = { month: '2024-01' };
            const result = await getPaymentsByMonth(input);

            expect(result).toHaveLength(2);
            // Most recent first (second payment should be first)
            expect(result[0].amount_due).toBe(30);
            expect(result[1].amount_due).toBe(50);
            
            // Verify the ordering by checking the actual timestamps
            expect(result[0].created_at.getTime()).toBeGreaterThan(result[1].created_at.getTime());
        });
    });

    describe('getMemberPaymentHistory', () => {
        it('should fetch payment history for a specific member', async () => {
            // Create multiple payment records for the member
            await db.insert(paymentRecordsTable)
                .values([
                    {
                        member_id: memberId,
                        month: '2024-01',
                        year: 2024,
                        month_number: 1,
                        amount_due: '50.00',
                        amount_paid: '50.00',
                        status: 'paid',
                        recorded_by: adminUserId
                    },
                    {
                        member_id: memberId,
                        month: '2024-02',
                        year: 2024,
                        month_number: 2,
                        amount_due: '50.00',
                        amount_paid: '0.00',
                        status: 'unpaid',
                        recorded_by: adminUserId
                    }
                ])
                .execute();

            const input: GetMemberPaymentHistoryInput = { member_id: memberId };
            const result = await getMemberPaymentHistory(input);

            expect(result).toHaveLength(2);
            expect(result[0].month).toBe('2024-02'); // Most recent first
            expect(result[1].month).toBe('2024-01');
            expect(typeof result[0].amount_due).toBe('number');
            expect(typeof result[0].amount_paid).toBe('number');
        });

        it('should return empty array for member with no payment history', async () => {
            // Create another member
            const anotherMemberUser = await db.insert(usersTable)
                .values({
                    email: 'another@test.com',
                    password: 'hashedpassword',
                    role: 'member'
                })
                .returning()
                .execute();

            const anotherMember = await db.insert(membersTable)
                .values({
                    name: 'Another Member',
                    phone: '9876543210',
                    email: 'another@test.com',
                    status: 'active',
                    cash_balance: '0.00',
                    user_id: anotherMemberUser[0].id
                })
                .returning()
                .execute();

            const input: GetMemberPaymentHistoryInput = { member_id: anotherMember[0].id };
            const result = await getMemberPaymentHistory(input);

            expect(result).toHaveLength(0);
        });
    });

    describe('getCurrentMonthPayment', () => {
        it('should fetch current month payment for a member', async () => {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const currentYear = new Date().getFullYear();
            const currentMonthNum = new Date().getMonth() + 1;

            // Create current month payment record
            await db.insert(paymentRecordsTable)
                .values({
                    member_id: memberId,
                    month: currentMonth,
                    year: currentYear,
                    month_number: currentMonthNum,
                    amount_due: '50.00',
                    amount_paid: '25.00',
                    status: 'partial',
                    recorded_by: adminUserId
                })
                .execute();

            const result = await getCurrentMonthPayment(memberId);

            expect(result).not.toBeNull();
            expect(result!.member_id).toBe(memberId);
            expect(result!.month).toBe(currentMonth);
            expect(result!.amount_due).toBe(50);
            expect(result!.amount_paid).toBe(25);
            expect(result!.status).toBe('partial');
        });

        it('should return null if no current month payment exists', async () => {
            const result = await getCurrentMonthPayment(memberId);
            expect(result).toBeNull();
        });
    });

    describe('recordPayment', () => {
        it('should record a new payment successfully', async () => {
            const input: RecordPaymentInput = {
                member_id: memberId,
                month: '2024-03',
                amount_due: 75.50,
                amount_paid: 75.50,
                status: 'paid',
                payment_date: new Date(),
                notes: 'Full payment received'
            };

            const result = await recordPayment(input, adminUserId);

            expect(result.member_id).toBe(memberId);
            expect(result.month).toBe('2024-03');
            expect(result.year).toBe(2024);
            expect(result.month_number).toBe(3);
            expect(result.amount_due).toBe(75.50);
            expect(result.amount_paid).toBe(75.50);
            expect(result.status).toBe('paid');
            expect(result.recorded_by).toBe(adminUserId);
            expect(result.notes).toBe('Full payment received');
            expect(result.id).toBeDefined();
            expect(result.created_at).toBeInstanceOf(Date);
            expect(typeof result.amount_due).toBe('number');
            expect(typeof result.amount_paid).toBe('number');
        });

        it('should throw error if member does not exist', async () => {
            const input: RecordPaymentInput = {
                member_id: 99999, // Non-existent member
                month: '2024-03',
                amount_due: 50,
                amount_paid: 50,
                status: 'paid',
                payment_date: new Date()
            };

            expect(recordPayment(input, adminUserId)).rejects.toThrow(/Member with ID 99999 not found/);
        });

        it('should throw error if payment record already exists for member and month', async () => {
            const input: RecordPaymentInput = {
                member_id: memberId,
                month: '2024-03',
                amount_due: 50,
                amount_paid: 50,
                status: 'paid',
                payment_date: new Date()
            };

            // Record payment first time
            await recordPayment(input, adminUserId);

            // Try to record same payment again
            expect(recordPayment(input, adminUserId)).rejects.toThrow(/Payment record already exists/);
        });

        it('should handle partial payments correctly', async () => {
            const input: RecordPaymentInput = {
                member_id: memberId,
                month: '2024-04',
                amount_due: 100,
                amount_paid: 60,
                status: 'partial',
                payment_date: new Date(),
                notes: 'Partial payment - balance pending'
            };

            const result = await recordPayment(input, adminUserId);

            expect(result.status).toBe('partial');
            expect(result.amount_due).toBe(100);
            expect(result.amount_paid).toBe(60);
            expect(result.notes).toBe('Partial payment - balance pending');
        });
    });

    describe('updatePayment', () => {
        beforeEach(async () => {
            // Create a payment record to update
            const payment = await db.insert(paymentRecordsTable)
                .values({
                    member_id: memberId,
                    month: '2024-05',
                    year: 2024,
                    month_number: 5,
                    amount_due: '100.00',
                    amount_paid: '50.00',
                    status: 'partial',
                    recorded_by: adminUserId,
                    notes: 'Initial partial payment'
                })
                .returning()
                .execute();
            paymentRecordId = payment[0].id;
        });

        it('should update payment amount and status', async () => {
            const input: UpdatePaymentInput = {
                id: paymentRecordId,
                amount_paid: 100,
                status: 'paid',
                payment_date: new Date(),
                notes: 'Payment completed'
            };

            const result = await updatePayment(input, adminUserId);

            expect(result).not.toBeNull();
            expect(result!.id).toBe(paymentRecordId);
            expect(result!.amount_paid).toBe(100);
            expect(result!.status).toBe('paid');
            expect(result!.notes).toBe('Payment completed');
            expect(result!.updated_at).toBeInstanceOf(Date);
            expect(typeof result!.amount_paid).toBe('number');
        });

        it('should return null if payment record does not exist', async () => {
            const input: UpdatePaymentInput = {
                id: 99999, // Non-existent payment
                amount_paid: 50
            };

            const result = await updatePayment(input, adminUserId);
            expect(result).toBeNull();
        });

        it('should update only provided fields', async () => {
            const input: UpdatePaymentInput = {
                id: paymentRecordId,
                notes: 'Updated notes only'
            };

            const result = await updatePayment(input, adminUserId);

            expect(result).not.toBeNull();
            expect(result!.notes).toBe('Updated notes only');
            expect(result!.amount_paid).toBe(50); // Should remain unchanged
            expect(result!.status).toBe('partial'); // Should remain unchanged
        });
    });

    describe('getMembersWithOutstandingPayments', () => {
        beforeEach(async () => {
            // Create another member for more comprehensive testing
            const anotherMemberUser = await db.insert(usersTable)
                .values({
                    email: 'member2@test.com',
                    password: 'hashedpassword',
                    role: 'member'
                })
                .returning()
                .execute();

            const anotherMember = await db.insert(membersTable)
                .values({
                    name: 'Member Two',
                    phone: '9876543210',
                    email: 'member2@test.com',
                    status: 'active',
                    cash_balance: '50.00',
                    user_id: anotherMemberUser[0].id
                })
                .returning()
                .execute();

            // Create payment records with different statuses
            await db.insert(paymentRecordsTable)
                .values([
                    {
                        member_id: memberId,
                        month: '2024-06',
                        year: 2024,
                        month_number: 6,
                        amount_due: '100.00',
                        amount_paid: '0.00',
                        status: 'unpaid',
                        recorded_by: adminUserId
                    },
                    {
                        member_id: anotherMember[0].id,
                        month: '2024-06',
                        year: 2024,
                        month_number: 6,
                        amount_due: '100.00',
                        amount_paid: '60.00',
                        status: 'partial',
                        recorded_by: adminUserId
                    },
                    {
                        member_id: memberId,
                        month: '2024-07',
                        year: 2024,
                        month_number: 7,
                        amount_due: '100.00',
                        amount_paid: '100.00',
                        status: 'paid',
                        recorded_by: adminUserId
                    }
                ])
                .execute();
        });

        it('should fetch members with unpaid and partial payments for specific month', async () => {
            const result = await getMembersWithOutstandingPayments('2024-06');

            expect(result).toHaveLength(2);
            
            // Check that both unpaid and partial payments are included
            const statuses = result.map(r => r.status);
            expect(statuses).toContain('unpaid');
            expect(statuses).toContain('partial');

            // Check member data is included
            expect(result[0].member).toBeDefined();
            expect(result[0].member.name).toBeDefined();
            expect(result[0].member.email).toBeDefined();
            expect(typeof result[0].member.cash_balance).toBe('number');
            expect(typeof result[0].amount_due).toBe('number');
            expect(typeof result[0].amount_paid).toBe('number');
        });

        it('should not include paid payments', async () => {
            const result = await getMembersWithOutstandingPayments('2024-07');

            expect(result).toHaveLength(0);
        });

        it('should return empty array for month with no outstanding payments', async () => {
            const result = await getMembersWithOutstandingPayments('2024-12');

            expect(result).toHaveLength(0);
        });
    });
});