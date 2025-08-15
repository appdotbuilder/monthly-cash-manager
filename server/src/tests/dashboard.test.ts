import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, membersTable, paymentRecordsTable } from '../db/schema';
import { getMemberDashboard, getAdminDashboard } from '../handlers/dashboard';

describe('Dashboard handlers', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    describe('getMemberDashboard', () => {
        it('should return null for non-existent member', async () => {
            const result = await getMemberDashboard(999);
            expect(result).toBeNull();
        });

        it('should return member dashboard data without payments', async () => {
            // Create admin user
            const adminUserResult = await db.insert(usersTable)
                .values({
                    email: 'admin@test.com',
                    password: 'hashedpassword',
                    role: 'admin'
                })
                .returning()
                .execute();
            
            const adminUser = adminUserResult[0];

            // Create member user
            const memberUserResult = await db.insert(usersTable)
                .values({
                    email: 'member@test.com',
                    password: 'hashedpassword',
                    role: 'member'
                })
                .returning()
                .execute();
            
            const memberUser = memberUserResult[0];

            // Create member
            const memberResult = await db.insert(membersTable)
                .values({
                    name: 'Test Member',
                    phone: '1234567890',
                    email: 'member@test.com',
                    status: 'active',
                    cash_balance: '150.50',
                    user_id: memberUser.id
                })
                .returning()
                .execute();
            
            const member = memberResult[0];

            const result = await getMemberDashboard(member.id);

            expect(result).not.toBeNull();
            expect(result!.member.id).toEqual(member.id);
            expect(result!.member.name).toEqual('Test Member');
            expect(result!.member.cash_balance).toEqual(150.50);
            expect(typeof result!.member.cash_balance).toBe('number');
            expect(result!.current_month_payment).toBeNull();
            expect(result!.recent_payments).toEqual([]);
        });

        it('should return member dashboard data with current month payment', async () => {
            // Create admin user
            const adminUserResult = await db.insert(usersTable)
                .values({
                    email: 'admin@test.com',
                    password: 'hashedpassword',
                    role: 'admin'
                })
                .returning()
                .execute();
            
            const adminUser = adminUserResult[0];

            // Create member user
            const memberUserResult = await db.insert(usersTable)
                .values({
                    email: 'member@test.com',
                    password: 'hashedpassword',
                    role: 'member'
                })
                .returning()
                .execute();
            
            const memberUser = memberUserResult[0];

            // Create member
            const memberResult = await db.insert(membersTable)
                .values({
                    name: 'Test Member',
                    phone: '1234567890',
                    email: 'member@test.com',
                    status: 'active',
                    cash_balance: '200.00',
                    user_id: memberUser.id
                })
                .returning()
                .execute();
            
            const member = memberResult[0];

            // Get current month
            const currentDate = new Date();
            const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

            // Create current month payment record
            await db.insert(paymentRecordsTable)
                .values({
                    member_id: member.id,
                    month: currentMonth,
                    year: currentDate.getFullYear(),
                    month_number: currentDate.getMonth() + 1,
                    amount_due: '100.00',
                    amount_paid: '100.00',
                    status: 'paid',
                    payment_date: new Date(),
                    recorded_by: adminUser.id,
                    notes: 'Test payment'
                })
                .execute();

            const result = await getMemberDashboard(member.id);

            expect(result).not.toBeNull();
            expect(result!.member.name).toEqual('Test Member');
            expect(result!.member.cash_balance).toEqual(200.00);
            expect(result!.current_month_payment).not.toBeNull();
            expect(result!.current_month_payment!.month).toEqual(currentMonth);
            expect(result!.current_month_payment!.amount_due).toEqual(100.00);
            expect(result!.current_month_payment!.amount_paid).toEqual(100.00);
            expect(typeof result!.current_month_payment!.amount_due).toBe('number');
            expect(typeof result!.current_month_payment!.amount_paid).toBe('number');
            expect(result!.current_month_payment!.status).toEqual('paid');
        });

        it('should return member dashboard data with recent payment history', async () => {
            // Create admin user
            const adminUserResult = await db.insert(usersTable)
                .values({
                    email: 'admin@test.com',
                    password: 'hashedpassword',
                    role: 'admin'
                })
                .returning()
                .execute();
            
            const adminUser = adminUserResult[0];

            // Create member user
            const memberUserResult = await db.insert(usersTable)
                .values({
                    email: 'member@test.com',
                    password: 'hashedpassword',
                    role: 'member'
                })
                .returning()
                .execute();
            
            const memberUser = memberUserResult[0];

            // Create member
            const memberResult = await db.insert(membersTable)
                .values({
                    name: 'Test Member',
                    phone: '1234567890',
                    email: 'member@test.com',
                    status: 'active',
                    cash_balance: '0.00',
                    user_id: memberUser.id
                })
                .returning()
                .execute();
            
            const member = memberResult[0];

            // Create multiple payment records
            const payments = [
                { month: '2024-01', year: 2024, month_number: 1, amount_due: '100.00', amount_paid: '100.00' },
                { month: '2024-02', year: 2024, month_number: 2, amount_due: '100.00', amount_paid: '50.00' },
                { month: '2024-03', year: 2024, month_number: 3, amount_due: '100.00', amount_paid: '0.00' }
            ];

            for (const payment of payments) {
                await db.insert(paymentRecordsTable)
                    .values({
                        member_id: member.id,
                        month: payment.month,
                        year: payment.year,
                        month_number: payment.month_number,
                        amount_due: payment.amount_due,
                        amount_paid: payment.amount_paid,
                        status: parseFloat(payment.amount_paid) === 0 ? 'unpaid' : 
                               parseFloat(payment.amount_paid) < parseFloat(payment.amount_due) ? 'partial' : 'paid',
                        payment_date: parseFloat(payment.amount_paid) > 0 ? new Date() : null,
                        recorded_by: adminUser.id
                    })
                    .execute();
            }

            const result = await getMemberDashboard(member.id);

            expect(result).not.toBeNull();
            expect(result!.recent_payments).toHaveLength(3);
            
            // Verify payments are ordered by most recent first (year desc, month_number desc)
            expect(result!.recent_payments[0].month).toEqual('2024-03');
            expect(result!.recent_payments[1].month).toEqual('2024-02');
            expect(result!.recent_payments[2].month).toEqual('2024-01');

            // Verify numeric conversions
            result!.recent_payments.forEach(payment => {
                expect(typeof payment.amount_due).toBe('number');
                expect(typeof payment.amount_paid).toBe('number');
            });

            expect(result!.recent_payments[0].amount_due).toEqual(100.00);
            expect(result!.recent_payments[1].amount_paid).toEqual(50.00);
        });
    });

    describe('getAdminDashboard', () => {
        it('should return empty dashboard stats with no data', async () => {
            const result = await getAdminDashboard();

            expect(result.total_members).toEqual(0);
            expect(result.active_members).toEqual(0);
            expect(result.current_month_collections).toEqual(0);
            expect(result.pending_payments).toEqual(0);
            expect(result.total_cash_balance).toEqual(0);
        });

        it('should return correct dashboard statistics', async () => {
            // Create admin user
            const adminUserResult = await db.insert(usersTable)
                .values({
                    email: 'admin@test.com',
                    password: 'hashedpassword',
                    role: 'admin'
                })
                .returning()
                .execute();
            
            const adminUser = adminUserResult[0];

            // Create multiple member users
            const memberUsers = [];
            for (let i = 1; i <= 3; i++) {
                const memberUserResult = await db.insert(usersTable)
                    .values({
                        email: `member${i}@test.com`,
                        password: 'hashedpassword',
                        role: 'member'
                    })
                    .returning()
                    .execute();
                memberUsers.push(memberUserResult[0]);
            }

            // Create members with different statuses
            const members = [
                { name: 'Active Member 1', status: 'active', cash_balance: '100.50', user_id: memberUsers[0].id },
                { name: 'Active Member 2', status: 'active', cash_balance: '200.25', user_id: memberUsers[1].id },
                { name: 'Inactive Member', status: 'inactive', cash_balance: '50.75', user_id: memberUsers[2].id }
            ];

            const createdMembers = [];
            for (const memberData of members) {
                const memberResult = await db.insert(membersTable)
                    .values({
                        name: memberData.name,
                        phone: '1234567890',
                        email: `${memberData.name.toLowerCase().replace(/\s+/g, '')}@test.com`,
                        status: memberData.status as 'active' | 'inactive',
                        cash_balance: memberData.cash_balance,
                        user_id: memberData.user_id
                    })
                    .returning()
                    .execute();
                createdMembers.push(memberResult[0]);
            }

            // Get current month
            const currentDate = new Date();
            const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

            // Create payment records for current month
            await db.insert(paymentRecordsTable)
                .values({
                    member_id: createdMembers[0].id,
                    month: currentMonth,
                    year: currentDate.getFullYear(),
                    month_number: currentDate.getMonth() + 1,
                    amount_due: '100.00',
                    amount_paid: '100.00',
                    status: 'paid',
                    payment_date: new Date(),
                    recorded_by: adminUser.id
                })
                .execute();

            await db.insert(paymentRecordsTable)
                .values({
                    member_id: createdMembers[1].id,
                    month: currentMonth,
                    year: currentDate.getFullYear(),
                    month_number: currentDate.getMonth() + 1,
                    amount_due: '100.00',
                    amount_paid: '50.00',
                    status: 'partial',
                    payment_date: new Date(),
                    recorded_by: adminUser.id
                })
                .execute();

            await db.insert(paymentRecordsTable)
                .values({
                    member_id: createdMembers[2].id,
                    month: currentMonth,
                    year: currentDate.getFullYear(),
                    month_number: currentDate.getMonth() + 1,
                    amount_due: '100.00',
                    amount_paid: '0.00',
                    status: 'unpaid',
                    payment_date: null,
                    recorded_by: adminUser.id
                })
                .execute();

            const result = await getAdminDashboard();

            expect(result.total_members).toEqual(3);
            expect(result.active_members).toEqual(2);
            expect(result.current_month_collections).toEqual(150.00); // 100 + 50
            expect(result.pending_payments).toEqual(2); // partial + unpaid
            expect(result.total_cash_balance).toEqual(351.5); // 100.50 + 200.25 + 50.75

            // Verify numeric types
            expect(typeof result.current_month_collections).toBe('number');
            expect(typeof result.total_cash_balance).toBe('number');
        });

        it('should handle zero collections and balances correctly', async () => {
            // Create admin user
            const adminUserResult = await db.insert(usersTable)
                .values({
                    email: 'admin@test.com',
                    password: 'hashedpassword',
                    role: 'admin'
                })
                .returning()
                .execute();
            
            const adminUser = adminUserResult[0];

            // Create member user
            const memberUserResult = await db.insert(usersTable)
                .values({
                    email: 'member@test.com',
                    password: 'hashedpassword',
                    role: 'member'
                })
                .returning()
                .execute();
            
            const memberUser = memberUserResult[0];

            // Create member with zero balance
            await db.insert(membersTable)
                .values({
                    name: 'Zero Balance Member',
                    phone: '1234567890',
                    email: 'member@test.com',
                    status: 'active',
                    cash_balance: '0.00',
                    user_id: memberUser.id
                })
                .execute();

            const result = await getAdminDashboard();

            expect(result.total_members).toEqual(1);
            expect(result.active_members).toEqual(1);
            expect(result.current_month_collections).toEqual(0);
            expect(result.pending_payments).toEqual(0);
            expect(result.total_cash_balance).toEqual(0);
        });
    });
});