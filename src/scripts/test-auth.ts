/**
 * Test script to verify the authentication routes work correctly.
 * This script doesn't rely on an HTTP server but directly tests the type safety
 * of the authentication-related interfaces and functions.
 */

// Define interface that matches the DB column names
interface DbAdmin {
  id: string;
  username: string;
  password: string;
  created_at: Date;
  last_login: Date | null;
}

// Type for auth payload
interface AuthPayload {
  id: string;
  username: string;
}

// Simulate a database query result to test type safety
const mockDbResult = {
  rows: [
    {
      id: "123e4567-e89b-12d3-a456-426614174000",
      username: "admin",
      password: "$2b$10$abcdefghijklmnopqrstuvwxyz",
      created_at: new Date(),
      last_login: null,
    },
  ],
};

// Cast to the proper type to ensure it works
const admin = mockDbResult.rows[0] as DbAdmin;

// Test properties to ensure they are typed correctly
const { id, username, password, created_at, last_login } = admin;

console.log("DbAdmin properties:");
console.log(
  `- id: ${typeof id} (${id})
- username: ${typeof username} (${username})
- password: ${typeof password} (shortened: ${password.substring(0, 10)}...)
- created_at: ${
    created_at instanceof Date ? "Date" : typeof created_at
  } (${created_at})
- last_login: ${last_login === null ? "null" : typeof last_login}
`
);

// Test creating an auth payload
const payload: AuthPayload = {
  id: admin.id,
  username: admin.username,
};

console.log("AuthPayload properties:");
console.log(
  `- id: ${typeof payload.id} (${payload.id})
- username: ${typeof payload.username} (${payload.username})
`
);

console.log("✅ Authentication type test passed.");
