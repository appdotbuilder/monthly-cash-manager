import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { authenticateUser, getCurrentUser, createHashedPassword } from '../handlers/auth';

describe('authenticateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testAdminUser = {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin' as const
  };

  const testMemberUser = {
    email: 'member@test.com',
    password: 'member123',
    role: 'member' as const
  };

  it('should authenticate admin user with correct credentials', async () => {
    // Create admin user with hashed password
    const hashedPassword = createHashedPassword(testAdminUser.password);
    await db.insert(usersTable)
      .values({
        email: testAdminUser.email,
        password: hashedPassword,
        role: testAdminUser.role
      })
      .execute();

    const loginInput: LoginInput = {
      email: testAdminUser.email,
      password: testAdminUser.password
    };

    const result = await authenticateUser(loginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toEqual(testAdminUser.email);
    expect(result!.role).toEqual('admin');
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    // Password should still be present in result as per schema
    expect(result!.password).toBeDefined();
  });

  it('should authenticate member user with correct credentials', async () => {
    // Create member user with hashed password
    const hashedPassword = createHashedPassword(testMemberUser.password);
    await db.insert(usersTable)
      .values({
        email: testMemberUser.email,
        password: hashedPassword,
        role: testMemberUser.role
      })
      .execute();

    const loginInput: LoginInput = {
      email: testMemberUser.email,
      password: testMemberUser.password
    };

    const result = await authenticateUser(loginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toEqual(testMemberUser.email);
    expect(result!.role).toEqual('member');
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent user', async () => {
    const loginInput: LoginInput = {
      email: 'nonexistent@test.com',
      password: 'anypassword'
    };

    const result = await authenticateUser(loginInput);

    expect(result).toBeNull();
  });

  it('should return null for incorrect password', async () => {
    // Create user with hashed password
    const hashedPassword = createHashedPassword(testAdminUser.password);
    await db.insert(usersTable)
      .values({
        email: testAdminUser.email,
        password: hashedPassword,
        role: testAdminUser.role
      })
      .execute();

    const loginInput: LoginInput = {
      email: testAdminUser.email,
      password: 'wrongpassword'
    };

    const result = await authenticateUser(loginInput);

    expect(result).toBeNull();
  });

  it('should handle empty email', async () => {
    const loginInput: LoginInput = {
      email: '',
      password: 'somepassword'
    };

    const result = await authenticateUser(loginInput);

    expect(result).toBeNull();
  });

  it('should verify password hashing works correctly', async () => {
    const plainPassword = 'test123456';
    const hashedPassword = createHashedPassword(plainPassword);
    
    await db.insert(usersTable)
      .values({
        email: 'hashtest@test.com',
        password: hashedPassword,
        role: 'admin'
      })
      .execute();

    // Should authenticate with plain password
    const loginInput: LoginInput = {
      email: 'hashtest@test.com',
      password: plainPassword
    };

    const result = await authenticateUser(loginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toEqual('hashtest@test.com');

    // Should not authenticate with wrong password
    const wrongLoginInput: LoginInput = {
      email: 'hashtest@test.com',
      password: 'wrongpassword'
    };

    const wrongResult = await authenticateUser(wrongLoginInput);
    expect(wrongResult).toBeNull();
  });

  it('should handle malformed hashed password', async () => {
    // Create user with invalid hash format (missing salt separator)
    await db.insert(usersTable)
      .values({
        email: 'baduser@test.com',
        password: 'invalidhash',
        role: 'admin'
      })
      .execute();

    const loginInput: LoginInput = {
      email: 'baduser@test.com',
      password: 'anypassword'
    };

    const result = await authenticateUser(loginInput);

    expect(result).toBeNull();
  });
});

describe('getCurrentUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testUser = {
    email: 'getuser@test.com',
    password: 'password123',
    role: 'admin' as const
  };

  it('should return user by valid ID', async () => {
    // Create test user
    const hashedPassword = createHashedPassword(testUser.password);
    const insertResult = await db.insert(usersTable)
      .values({
        email: testUser.email,
        password: hashedPassword,
        role: testUser.role
      })
      .returning()
      .execute();

    const userId = insertResult[0].id;

    const result = await getCurrentUser(userId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(userId);
    expect(result!.email).toEqual(testUser.email);
    expect(result!.role).toEqual('admin');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.password).toBeDefined();
  });

  it('should return null for non-existent user ID', async () => {
    const result = await getCurrentUser(99999);

    expect(result).toBeNull();
  });

  it('should return null for invalid user ID', async () => {
    const result = await getCurrentUser(-1);

    expect(result).toBeNull();
  });

  it('should handle different user roles correctly', async () => {
    // Create admin user
    const hashedPasswordAdmin = createHashedPassword('admin123');
    const adminResult = await db.insert(usersTable)
      .values({
        email: 'admin@test.com',
        password: hashedPasswordAdmin,
        role: 'admin'
      })
      .returning()
      .execute();

    // Create member user
    const hashedPasswordMember = createHashedPassword('member123');
    const memberResult = await db.insert(usersTable)
      .values({
        email: 'member@test.com',
        password: hashedPasswordMember,
        role: 'member'
      })
      .returning()
      .execute();

    // Test admin user retrieval
    const adminUser = await getCurrentUser(adminResult[0].id);
    expect(adminUser).not.toBeNull();
    expect(adminUser!.role).toEqual('admin');
    expect(adminUser!.email).toEqual('admin@test.com');

    // Test member user retrieval
    const memberUser = await getCurrentUser(memberResult[0].id);
    expect(memberUser).not.toBeNull();
    expect(memberUser!.role).toEqual('member');
    expect(memberUser!.email).toEqual('member@test.com');
  });

  it('should return consistent data structure', async () => {
    // Create test user
    const hashedPassword = createHashedPassword(testUser.password);
    const insertResult = await db.insert(usersTable)
      .values({
        email: testUser.email,
        password: hashedPassword,
        role: testUser.role
      })
      .returning()
      .execute();

    const userId = insertResult[0].id;

    const result = await getCurrentUser(userId);

    expect(result).not.toBeNull();
    
    // Verify all required fields are present
    expect(typeof result!.id).toBe('number');
    expect(typeof result!.email).toBe('string');
    expect(typeof result!.password).toBe('string');
    expect(['admin', 'member'].includes(result!.role)).toBe(true);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });
});

describe('createHashedPassword', () => {
  it('should create hashed password with salt and hash', async () => {
    const password = 'testpassword123';
    const hashedPassword = createHashedPassword(password);

    // Should contain salt and hash separated by colon
    expect(hashedPassword).toContain(':');
    
    const parts = hashedPassword.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBeDefined(); // salt
    expect(parts[1]).toBeDefined(); // hash
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('should create different hashes for same password', async () => {
    const password = 'samepassword';
    const hash1 = createHashedPassword(password);
    const hash2 = createHashedPassword(password);

    // Should be different due to random salt
    expect(hash1).not.toEqual(hash2);
    
    // But both should be valid hash format
    expect(hash1).toContain(':');
    expect(hash2).toContain(':');
  });
});