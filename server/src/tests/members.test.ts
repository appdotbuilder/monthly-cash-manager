import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, membersTable, paymentRecordsTable, notificationLogsTable } from '../db/schema';
import { type CreateMemberInput, type UpdateMemberInput } from '../schema';
import { 
  getAllMembers,
  getMemberById,
  getMemberByUserId,
  createMember,
  updateMember,
  deleteMember
} from '../handlers/members';
import { eq } from 'drizzle-orm';

// Test data
const testCreateMemberInput: CreateMemberInput = {
  name: 'John Doe',
  phone: '1234567890',
  email: 'john@example.com',
  status: 'active',
  cash_balance: 150.75,
  password: 'password123'
};

const testCreateMemberInput2: CreateMemberInput = {
  name: 'Jane Smith',
  phone: '0987654321',
  email: 'jane@example.com',
  status: 'inactive',
  cash_balance: 200.25,
  password: 'password456'
};

describe('Members Handler', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createMember', () => {
    it('should create a member with user account', async () => {
      const result = await createMember(testCreateMemberInput);

      // Validate member fields
      expect(result.name).toEqual('John Doe');
      expect(result.phone).toEqual('1234567890');
      expect(result.email).toEqual('john@example.com');
      expect(result.status).toEqual('active');
      expect(result.cash_balance).toEqual(150.75);
      expect(typeof result.cash_balance).toBe('number');
      expect(result.id).toBeDefined();
      expect(result.user_id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create associated user account', async () => {
      const member = await createMember(testCreateMemberInput);

      // Verify user account was created
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, member.user_id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].email).toEqual('john@example.com');
      expect(users[0].role).toEqual('member');
      expect(users[0].password).toEqual('hashed_password123');
    });

    it('should save member to database with correct numeric conversion', async () => {
      const result = await createMember(testCreateMemberInput);

      // Query database directly to verify storage
      const members = await db.select()
        .from(membersTable)
        .where(eq(membersTable.id, result.id))
        .execute();

      expect(members).toHaveLength(1);
      expect(members[0].name).toEqual('John Doe');
      expect(parseFloat(members[0].cash_balance)).toEqual(150.75);
    });

    it('should handle unique constraint violation', async () => {
      await createMember(testCreateMemberInput);

      // Attempt to create member with same email
      await expect(createMember(testCreateMemberInput)).rejects.toThrow();
    });
  });

  describe('getAllMembers', () => {
    it('should return empty array when no members exist', async () => {
      const result = await getAllMembers();
      expect(result).toEqual([]);
    });

    it('should return all members with numeric conversion', async () => {
      await createMember(testCreateMemberInput);
      await createMember(testCreateMemberInput2);

      const result = await getAllMembers();

      expect(result).toHaveLength(2);
      
      // Verify first member
      const johnMember = result.find(m => m.name === 'John Doe');
      expect(johnMember).toBeDefined();
      expect(johnMember?.cash_balance).toEqual(150.75);
      expect(typeof johnMember?.cash_balance).toBe('number');
      
      // Verify second member
      const janeMember = result.find(m => m.name === 'Jane Smith');
      expect(janeMember).toBeDefined();
      expect(janeMember?.cash_balance).toEqual(200.25);
      expect(typeof janeMember?.cash_balance).toBe('number');
    });
  });

  describe('getMemberById', () => {
    it('should return null for non-existent member', async () => {
      const result = await getMemberById(999);
      expect(result).toBeNull();
    });

    it('should return member by ID with numeric conversion', async () => {
      const createdMember = await createMember(testCreateMemberInput);

      const result = await getMemberById(createdMember.id);

      expect(result).not.toBeNull();
      expect(result?.name).toEqual('John Doe');
      expect(result?.cash_balance).toEqual(150.75);
      expect(typeof result?.cash_balance).toBe('number');
      expect(result?.id).toEqual(createdMember.id);
    });
  });

  describe('getMemberByUserId', () => {
    it('should return null for non-existent user', async () => {
      const result = await getMemberByUserId(999);
      expect(result).toBeNull();
    });

    it('should return member by user ID with numeric conversion', async () => {
      const createdMember = await createMember(testCreateMemberInput);

      const result = await getMemberByUserId(createdMember.user_id);

      expect(result).not.toBeNull();
      expect(result?.name).toEqual('John Doe');
      expect(result?.cash_balance).toEqual(150.75);
      expect(typeof result?.cash_balance).toBe('number');
      expect(result?.user_id).toEqual(createdMember.user_id);
    });
  });

  describe('updateMember', () => {
    it('should return null for non-existent member', async () => {
      const updateInput: UpdateMemberInput = {
        id: 999,
        name: 'Updated Name'
      };

      const result = await updateMember(updateInput);
      expect(result).toBeNull();
    });

    it('should update member name only', async () => {
      const createdMember = await createMember(testCreateMemberInput);

      const updateInput: UpdateMemberInput = {
        id: createdMember.id,
        name: 'John Updated'
      };

      const result = await updateMember(updateInput);

      expect(result).not.toBeNull();
      expect(result?.name).toEqual('John Updated');
      expect(result?.phone).toEqual('1234567890'); // Should remain unchanged
      expect(result?.email).toEqual('john@example.com'); // Should remain unchanged
      expect(result?.cash_balance).toEqual(150.75); // Should remain unchanged
      expect(typeof result?.cash_balance).toBe('number');
    });

    it('should update multiple fields including numeric cash_balance', async () => {
      const createdMember = await createMember(testCreateMemberInput);

      const updateInput: UpdateMemberInput = {
        id: createdMember.id,
        name: 'John Updated',
        phone: '9999999999',
        status: 'suspended',
        cash_balance: 300.50
      };

      const result = await updateMember(updateInput);

      expect(result).not.toBeNull();
      expect(result?.name).toEqual('John Updated');
      expect(result?.phone).toEqual('9999999999');
      expect(result?.status).toEqual('suspended');
      expect(result?.cash_balance).toEqual(300.50);
      expect(typeof result?.cash_balance).toBe('number');
      expect(result?.email).toEqual('john@example.com'); // Should remain unchanged
    });

    it('should update updated_at timestamp', async () => {
      const createdMember = await createMember(testCreateMemberInput);
      const originalUpdatedAt = createdMember.updated_at;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updateInput: UpdateMemberInput = {
        id: createdMember.id,
        name: 'John Updated'
      };

      const result = await updateMember(updateInput);

      expect(result).not.toBeNull();
      expect(result?.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('deleteMember', () => {
    it('should return false for non-existent member', async () => {
      const result = await deleteMember(999);
      expect(result).toBe(false);
    });

    it('should delete member and associated user account', async () => {
      const createdMember = await createMember(testCreateMemberInput);

      const result = await deleteMember(createdMember.id);

      expect(result).toBe(true);

      // Verify member is deleted
      const memberCheck = await getMemberById(createdMember.id);
      expect(memberCheck).toBeNull();

      // Verify user account is deleted
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, createdMember.user_id))
        .execute();

      expect(users).toHaveLength(0);
    });

    it('should delete member with related payment records and notifications', async () => {
      // Create member first
      const createdMember = await createMember(testCreateMemberInput);

      // Create admin user for recording payment
      const adminUser = await db.insert(usersTable)
        .values({
          email: 'admin@example.com',
          password: 'hashed_admin_password',
          role: 'admin'
        })
        .returning()
        .execute();

      // Create payment record
      await db.insert(paymentRecordsTable)
        .values({
          member_id: createdMember.id,
          month: '2024-01',
          year: 2024,
          month_number: 1,
          amount_due: '100.00',
          amount_paid: '100.00',
          status: 'paid',
          recorded_by: adminUser[0].id
        })
        .execute();

      // Create notification log
      await db.insert(notificationLogsTable)
        .values({
          member_id: createdMember.id,
          type: 'payment_reminder',
          message: 'Test notification',
          sent_by: adminUser[0].id,
          status: 'sent'
        })
        .execute();

      const result = await deleteMember(createdMember.id);

      expect(result).toBe(true);

      // Verify all related records are deleted
      const paymentRecords = await db.select()
        .from(paymentRecordsTable)
        .where(eq(paymentRecordsTable.member_id, createdMember.id))
        .execute();

      const notifications = await db.select()
        .from(notificationLogsTable)
        .where(eq(notificationLogsTable.member_id, createdMember.id))
        .execute();

      expect(paymentRecords).toHaveLength(0);
      expect(notifications).toHaveLength(0);
    });
  });
});