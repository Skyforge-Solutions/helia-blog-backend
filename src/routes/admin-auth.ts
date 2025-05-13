// Admin authentication routes
import express, { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db, withClient } from "../db";
import * as bcrypt from "bcrypt";

/**
 * TypeScript interface for admin user from database
 */
interface AdminUser {
  id: string;
  username: string;
  password: string;
  created_at: Date;
  last_login: Date | null;
}

/**
 * TypeScript interface for authentication payload
 */
interface AuthPayload {
  id: string;
  username: string;
}

// Create express router
const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate admin user and set session/cookies
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    // Get credentials from request - correctly typed
    const username = req.body?.username as string;
    const password = req.body?.password as string;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Database variable to store admin user
    let foundAdmin: AdminUser | null = null;

    // Query database for admin user
    await withClient(async (client) => {
      const result = await client.query(
        "SELECT id, username, password, created_at, last_login FROM admins WHERE username = $1",
        [username]
      );

      if (result.rows.length > 0) {
        // User found, manually map fields to avoid type issues
        const row = result.rows[0];
        foundAdmin = {
          id: row.id,
          username: row.username,
          password: row.password,
          created_at: row.created_at,
          last_login: row.last_login,
        };
      }
    });

    // Handle case where admin is not found
    if (!foundAdmin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password with a known-to-be-not-null admin
    const adminPassword = foundAdmin.password;
    const validPassword = await bcrypt.compare(password, adminPassword);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Use a non-null reference to admin for type safety
    const adminId = foundAdmin.id;
    const adminUsername = foundAdmin.username;

    // Update last login timestamp
    await withClient(async (client) => {
      await client.query(
        "UPDATE admins SET last_login = NOW() WHERE id = $1",
        [adminId] // Using extracted variable instead of admin.id
      );
    });

    // Create payload for JWT and session
    const authPayload: AuthPayload = {
      id: adminId,
      username: adminUsername,
    };

    // Set JWT cookie
    res.cookie(
      "admin_token",
      jwt.sign(authPayload, process.env.JWT_SECRET || "secret"),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 60 * 1000, // 30 minutes
        sameSite: "lax",
        signed: true,
      }
    );

    // Set session data
    if (req.session) {
      (req.session as any).admin = authPayload;
    }

    // Send success response
    return res.json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

/**
 * POST /api/auth/logout
 * Clear admin authentication
 */
router.post("/logout", (req: Request, res: Response) => {
  // Clear session
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }
    });
  }

  // Clear auth cookie
  res.clearCookie("admin_token");

  // Send success response
  return res.json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * GET /api/auth/validate
 * Check if user is authenticated
 */
router.get("/validate", (req: Request, res: Response) => {
  const admin = (req as any).admin as AuthPayload | undefined;

  if (admin) {
    return res.json({
      success: true,
      data: {
        username: admin.username,
        authenticated: true,
      },
    });
  } else {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }
});

export default router;
