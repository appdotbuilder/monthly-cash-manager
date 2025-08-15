import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, membersTable, notificationLogsTable } from '../db/schema';
import { type SendNotificationInput } from '../schema';
import { 
    sendWhatsAppNotifications, 
    getNotificationHistory, 
    getMemberNotifications 
} from '../handlers/notifications';
import { eq } from 'drizzle-orm';

describe('Notifications Handlers', () => {
    let adminUserId: number;
    let memberUserId: number;
    let memberId: number;
    let secondMemberUserId: number;
    let secondMemberId: number;

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

        // Create first member user
        const memberUser = await db.insert(usersTable)
            .values({
                email: 'member@test.com',
                password: 'hashedpassword',
                role: 'member'
            })
            .returning()
            .execute();
        memberUserId = memberUser[0].id;

        // Create first member
        const member = await db.insert(membersTable)
            .values({
                name: 'John Doe',
                phone: '1234567890',
                email: 'member@test.com',
                status: 'active',
                cash_balance: '100.00',
                user_id: memberUserId
            })
            .returning()
            .execute();
        memberId = member[0].id;

        // Create second member user
        const secondMemberUser = await db.insert(usersTable)
            .values({
                email: 'member2@test.com',
                password: 'hashedpassword',
                role: 'member'
            })
            .returning()
            .execute();
        secondMemberUserId = secondMemberUser[0].id;

        // Create second member
        const secondMember = await db.insert(membersTable)
            .values({
                name: 'Jane Smith',
                phone: '0987654321',
                email: 'member2@test.com',
                status: 'active',
                cash_balance: '200.00',
                user_id: secondMemberUserId
            })
            .returning()
            .execute();
        secondMemberId = secondMember[0].id;
    });

    afterEach(resetDB);

    describe('sendWhatsAppNotifications', () => {
        const testInput: SendNotificationInput = {
            member_ids: [],
            type: 'payment_reminder',
            message: 'Please pay your monthly dues.'
        };

        it('should send notifications to single member', async () => {
            const input = { ...testInput, member_ids: [memberId] };
            const result = await sendWhatsAppNotifications(input, adminUserId);

            expect(result).toHaveLength(1);
            expect(result[0].member_id).toEqual(memberId);
            expect(result[0].type).toEqual('payment_reminder');
            expect(result[0].message).toEqual('Please pay your monthly dues.');
            expect(result[0].sent_by).toEqual(adminUserId);
            expect(result[0].status).toEqual('sent');
            expect(result[0].id).toBeDefined();
            expect(result[0].sent_at).toBeInstanceOf(Date);
        });

        it('should send notifications to multiple members', async () => {
            const input = { ...testInput, member_ids: [memberId, secondMemberId] };
            const result = await sendWhatsAppNotifications(input, adminUserId);

            expect(result).toHaveLength(2);
            
            // Check first notification
            const firstNotification = result.find(n => n.member_id === memberId);
            expect(firstNotification).toBeDefined();
            expect(firstNotification?.type).toEqual('payment_reminder');
            expect(firstNotification?.sent_by).toEqual(adminUserId);
            expect(firstNotification?.status).toEqual('sent');

            // Check second notification
            const secondNotification = result.find(n => n.member_id === secondMemberId);
            expect(secondNotification).toBeDefined();
            expect(secondNotification?.type).toEqual('payment_reminder');
            expect(secondNotification?.sent_by).toEqual(adminUserId);
            expect(secondNotification?.status).toEqual('sent');
        });

        it('should save notifications to database', async () => {
            const input = { ...testInput, member_ids: [memberId] };
            const result = await sendWhatsAppNotifications(input, adminUserId);

            // Query database to verify notification was saved
            const notifications = await db.select()
                .from(notificationLogsTable)
                .where(eq(notificationLogsTable.id, result[0].id))
                .execute();

            expect(notifications).toHaveLength(1);
            expect(notifications[0].member_id).toEqual(memberId);
            expect(notifications[0].type).toEqual('payment_reminder');
            expect(notifications[0].message).toEqual('Please pay your monthly dues.');
            expect(notifications[0].sent_by).toEqual(adminUserId);
            expect(notifications[0].status).toEqual('sent');
        });

        it('should handle balance_info notification type', async () => {
            const input: SendNotificationInput = {
                member_ids: [memberId],
                type: 'balance_info',
                message: 'Your current balance is $100.'
            };
            
            const result = await sendWhatsAppNotifications(input, adminUserId);

            expect(result).toHaveLength(1);
            expect(result[0].type).toEqual('balance_info');
            expect(result[0].message).toEqual('Your current balance is $100.');
        });
    });

    describe('getNotificationHistory', () => {
        beforeEach(async () => {
            // Create test notifications with explicit timing to ensure proper ordering
            await db.insert(notificationLogsTable)
                .values({
                    member_id: memberId,
                    type: 'payment_reminder',
                    message: 'First reminder',
                    sent_by: adminUserId,
                    status: 'sent'
                })
                .execute();

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            await db.insert(notificationLogsTable)
                .values({
                    member_id: secondMemberId,
                    type: 'balance_info',
                    message: 'Balance update',
                    sent_by: adminUserId,
                    status: 'sent'
                })
                .execute();

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            await db.insert(notificationLogsTable)
                .values({
                    member_id: memberId,
                    type: 'payment_reminder',
                    message: 'Second reminder',
                    sent_by: adminUserId,
                    status: 'failed'
                })
                .execute();
        });

        it('should return all notification history', async () => {
            const result = await getNotificationHistory();

            expect(result).toHaveLength(3);
            
            // Should be ordered by sent_at descending (most recent first)
            expect(result[0].message).toEqual('Second reminder');
            expect(result[1].message).toEqual('Balance update');
            expect(result[2].message).toEqual('First reminder');
        });

        it('should return empty array when no notifications exist', async () => {
            // Clear all notifications
            await db.delete(notificationLogsTable).execute();

            const result = await getNotificationHistory();
            expect(result).toHaveLength(0);
        });

        it('should include all notification fields', async () => {
            const result = await getNotificationHistory();

            expect(result.length).toBeGreaterThan(0);
            const notification = result[0];
            
            expect(notification.id).toBeDefined();
            expect(notification.member_id).toBeDefined();
            expect(notification.type).toBeDefined();
            expect(notification.message).toBeDefined();
            expect(notification.sent_at).toBeInstanceOf(Date);
            expect(notification.sent_by).toEqual(adminUserId);
            expect(notification.status).toBeDefined();
        });
    });

    describe('getMemberNotifications', () => {
        beforeEach(async () => {
            // Create test notifications for both members with explicit timing
            await db.insert(notificationLogsTable)
                .values({
                    member_id: memberId,
                    type: 'payment_reminder',
                    message: 'Payment due reminder',
                    sent_by: adminUserId,
                    status: 'sent'
                })
                .execute();

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            await db.insert(notificationLogsTable)
                .values({
                    member_id: secondMemberId,
                    type: 'balance_info',
                    message: 'Balance information',
                    sent_by: adminUserId,
                    status: 'sent'
                })
                .execute();

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            await db.insert(notificationLogsTable)
                .values({
                    member_id: memberId,
                    type: 'balance_info',
                    message: 'Your balance update',
                    sent_by: adminUserId,
                    status: 'sent'
                })
                .execute();
        });

        it('should return notifications for specific member only', async () => {
            const result = await getMemberNotifications(memberId);

            expect(result).toHaveLength(2);
            result.forEach(notification => {
                expect(notification.member_id).toEqual(memberId);
            });

            // Check messages
            const messages = result.map(n => n.message);
            expect(messages).toContain('Payment due reminder');
            expect(messages).toContain('Your balance update');
            expect(messages).not.toContain('Balance information');
        });

        it('should return notifications in descending order by sent_at', async () => {
            const result = await getMemberNotifications(memberId);

            expect(result).toHaveLength(2);
            // Most recent should be first
            expect(result[0].message).toEqual('Your balance update');
            expect(result[1].message).toEqual('Payment due reminder');
        });

        it('should return empty array for member with no notifications', async () => {
            // Create a new member with no notifications
            const newMemberUser = await db.insert(usersTable)
                .values({
                    email: 'newmember@test.com',
                    password: 'hashedpassword',
                    role: 'member'
                })
                .returning()
                .execute();

            const newMember = await db.insert(membersTable)
                .values({
                    name: 'New Member',
                    phone: '5555555555',
                    email: 'newmember@test.com',
                    status: 'active',
                    cash_balance: '0.00',
                    user_id: newMemberUser[0].id
                })
                .returning()
                .execute();

            const result = await getMemberNotifications(newMember[0].id);
            expect(result).toHaveLength(0);
        });

        it('should include all notification fields', async () => {
            const result = await getMemberNotifications(memberId);

            expect(result.length).toBeGreaterThan(0);
            const notification = result[0];

            expect(notification.id).toBeDefined();
            expect(notification.member_id).toEqual(memberId);
            expect(notification.type).toBeDefined();
            expect(notification.message).toBeDefined();
            expect(notification.sent_at).toBeInstanceOf(Date);
            expect(notification.sent_by).toEqual(adminUserId);
            expect(notification.status).toBeDefined();
        });
    });
});