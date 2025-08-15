import { db } from '../db';
import { notificationLogsTable, membersTable } from '../db/schema';
import { type SendNotificationInput, type NotificationLog } from '../schema';
import { eq, desc, and } from 'drizzle-orm';

// Send WhatsApp notifications to members
export async function sendWhatsAppNotifications(
    input: SendNotificationInput, 
    adminUserId: number
): Promise<NotificationLog[]> {
    try {
        // For each member_id, create a notification log entry
        const notificationPromises = input.member_ids.map(async (memberId) => {
            // In a real implementation, this would integrate with WhatsApp API
            // For now, we'll assume all notifications are sent successfully
            // and create log entries in the database
            
            const result = await db.insert(notificationLogsTable)
                .values({
                    member_id: memberId,
                    type: input.type,
                    message: input.message,
                    sent_by: adminUserId,
                    status: 'sent' // In real implementation, this would depend on WhatsApp API response
                })
                .returning()
                .execute();

            return result[0];
        });

        const notifications = await Promise.all(notificationPromises);
        return notifications;
    } catch (error) {
        console.error('Failed to send WhatsApp notifications:', error);
        throw error;
    }
}

// Get notification history for admin
export async function getNotificationHistory(): Promise<NotificationLog[]> {
    try {
        const notifications = await db.select()
            .from(notificationLogsTable)
            .orderBy(desc(notificationLogsTable.sent_at))
            .execute();

        return notifications;
    } catch (error) {
        console.error('Failed to get notification history:', error);
        throw error;
    }
}

// Get notifications sent to a specific member
export async function getMemberNotifications(memberId: number): Promise<NotificationLog[]> {
    try {
        const notifications = await db.select()
            .from(notificationLogsTable)
            .where(eq(notificationLogsTable.member_id, memberId))
            .orderBy(desc(notificationLogsTable.sent_at))
            .execute();

        return notifications;
    } catch (error) {
        console.error('Failed to get member notifications:', error);
        throw error;
    }
}