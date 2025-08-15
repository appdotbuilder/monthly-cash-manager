import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

// Simple password hashing utility using Node.js crypto
function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt || randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, usedSalt, 1000, 64, 'sha512').toString('hex');
  return `${usedSalt}:${hash}`;
}

function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  if (!salt || !hash) {
    return false;
  }
  const verifyHash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Authentication handler for both admin and member login
export async function authenticateUser(input: LoginInput): Promise<User | null> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return null; // User not found
    }

    const user = users[0];

    // Verify password
    const passwordMatch = verifyPassword(input.password, user.password);
    
    if (!passwordMatch) {
      return null; // Invalid password
    }

    // Return user data without password
    return {
      id: user.id,
      email: user.email,
      password: user.password, // Keep as per schema but should be handled carefully in real app
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

// Get current user by ID (for session management)
export async function getCurrentUser(userId: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      return null; // User not found
    }

    const user = users[0];

    return {
      id: user.id,
      email: user.email,
      password: user.password,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
}

// Export utility function for creating users with hashed passwords
export function createHashedPassword(password: string): string {
  return hashPassword(password);
}