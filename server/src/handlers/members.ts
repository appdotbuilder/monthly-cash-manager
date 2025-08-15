import { db } from '../db';
import { usersTable, membersTable, paymentRecordsTable, notificationLogsTable } from '../db/schema';
import { type Member, type CreateMemberInput, type UpdateMemberInput } from '../schema';
import { eq } from 'drizzle-orm';

// Get all members with their details for admin management
export async function getAllMembers(): Promise<Member[]> {
  try {
    const results = await db.select()
      .from(membersTable)
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(member => ({
      ...member,
      cash_balance: parseFloat(member.cash_balance) // Convert string to number
    }));
  } catch (error) {
    console.error('Failed to fetch all members:', error);
    throw error;
  }
}

// Get a specific member by ID
export async function getMemberById(memberId: number): Promise<Member | null> {
  try {
    const results = await db.select()
      .from(membersTable)
      .where(eq(membersTable.id, memberId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const member = results[0];
    return {
      ...member,
      cash_balance: parseFloat(member.cash_balance) // Convert string to number
    };
  } catch (error) {
    console.error('Failed to fetch member by ID:', error);
    throw error;
  }
}

// Get member by user ID (for member dashboard)
export async function getMemberByUserId(userId: number): Promise<Member | null> {
  try {
    const results = await db.select()
      .from(membersTable)
      .where(eq(membersTable.user_id, userId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const member = results[0];
    return {
      ...member,
      cash_balance: parseFloat(member.cash_balance) // Convert string to number
    };
  } catch (error) {
    console.error('Failed to fetch member by user ID:', error);
    throw error;
  }
}

// Create a new member (admin function)
export async function createMember(input: CreateMemberInput): Promise<Member> {
  try {
    // Hash the password (in a real app, use bcrypt or similar)
    const hashedPassword = `hashed_${input.password}`;

    // Create user account first
    const userResult = await db.insert(usersTable)
      .values({
        email: input.email,
        password: hashedPassword,
        role: 'member'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create member profile
    const memberResult = await db.insert(membersTable)
      .values({
        name: input.name,
        phone: input.phone,
        email: input.email,
        status: input.status,
        cash_balance: input.cash_balance.toString(), // Convert number to string for numeric column
        user_id: user.id
      })
      .returning()
      .execute();

    const member = memberResult[0];
    
    // Convert numeric fields back to numbers before returning
    return {
      ...member,
      cash_balance: parseFloat(member.cash_balance) // Convert string back to number
    };
  } catch (error) {
    console.error('Member creation failed:', error);
    throw error;
  }
}

// Update member details (admin function)
export async function updateMember(input: UpdateMemberInput): Promise<Member | null> {
  try {
    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.phone !== undefined) {
      updateData.phone = input.phone;
    }
    if (input.email !== undefined) {
      updateData.email = input.email;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.cash_balance !== undefined) {
      updateData.cash_balance = input.cash_balance.toString(); // Convert number to string for numeric column
    }

    const results = await db.update(membersTable)
      .set(updateData)
      .where(eq(membersTable.id, input.id))
      .returning()
      .execute();

    if (results.length === 0) {
      return null;
    }

    const member = results[0];
    return {
      ...member,
      cash_balance: parseFloat(member.cash_balance) // Convert string back to number
    };
  } catch (error) {
    console.error('Member update failed:', error);
    throw error;
  }
}

// Delete a member (admin function)
export async function deleteMember(memberId: number): Promise<boolean> {
  try {
    // Get the member to find associated user_id
    const member = await getMemberById(memberId);
    if (!member) {
      return false;
    }

    // Delete related notification logs first (foreign key constraint)
    await db.delete(notificationLogsTable)
      .where(eq(notificationLogsTable.member_id, memberId))
      .execute();

    // Delete related payment records (foreign key constraint)
    await db.delete(paymentRecordsTable)
      .where(eq(paymentRecordsTable.member_id, memberId))
      .execute();

    // Delete member record
    const memberDeleteResult = await db.delete(membersTable)
      .where(eq(membersTable.id, memberId))
      .execute();

    // Delete associated user account
    await db.delete(usersTable)
      .where(eq(usersTable.id, member.user_id))
      .execute();

    return (memberDeleteResult.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Member deletion failed:', error);
    throw error;
  }
}