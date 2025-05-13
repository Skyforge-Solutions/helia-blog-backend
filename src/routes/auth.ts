// Admin authentication routes
import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db, withClient } from "../db";
import { admins } from "../schema";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcrypt";

// Define our types that match the database structure
interface AdminDB {
  id: string;
  username: string;
  password: string;
  created_at: Date;
  last_login: Date | null;
}

// Type for auth payload
interface AdminPayload {
  id: string;
  username: string;
}

const router = Router();

/**
 * POST /api/auth/login
 * Admin login endpoint that validates credentials and sets authentication cookies
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    // Type the request body
    const body = req.body as { username?: string; password?: string };
    const username = body.username;
    const password = body.password;

    // Input validation
    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: "Username and password are required",
      });
      return;
    }

    // Search for the admin user
    let adminUser: AdminDB | null = null;

    // First db operation: find the admin
    try {
      await withClient(async (client) => {
        const result = await client.query(
          "SELECT id, username, password, created_at, last_login FROM admins WHERE username = $1 LIMIT 1",
          [username]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          adminUser = {
            id: row.id,
            username: row.username,
            password: row.password,
            created_at: row.created_at,
            last_login: row.last_login,
          };
        }
      });
    } catch (error) {
      console.error("Database error searching for admin:", error);
      res.status(500).json({
        success: false,
        error: "Database error occurred",
      });
      return;
    }

    // Check if admin exists
    if (!adminUser) {
      res.status(401).json({
        success: false,
        error: "Invalid username or password",
      });
      return;
    }

    // Verify password - Using non-null assertion since we've checked above that adminUser is not null
    try {
      const isValid = await bcrypt.compare(password, adminUser!.password);

      if (!isValid) {
        res.status(401).json({
          success: false,
          error: "Invalid username or password",
        });
        return;
      }
    } catch (error) {
      console.error("Password verification error:", error);
      res.status(500).json({
        success: false,
        error: "Authentication error",
      });
      return;
    }

    // Update last login time - Safe to use non-null assertion since we already checked
    try {
      await withClient(async (client) => {
        await client.query(
          "UPDATE admins SET last_login = NOW() WHERE id = $1",
          [adminUser!.id]
        );
      });
    } catch (error) {
      // Just log the error, don't fail login
      console.error("Failed to update last login time:", error);
    }

    // Create auth payload - Safe to use non-null assertion here
    const authPayload: AdminPayload = {
      id: adminUser!.id,
      username: adminUser!.username,
    };

    // Set JWT cookie
    res.cookie(
      "admin_token",
      jwt.sign(authPayload, process.env.JWT_SECRET || "secret_key", {
        expiresIn: "30m",
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 60 * 1000,
        sameSite: "lax",
        signed: true,
      }
    );

    // Set session data
    if (req.session) {
      (req.session as any).admin = authPayload;
    }

    // Success response
    res.json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Unexpected login error:", error);
    res.status(500).json({
      success: false,
      error: "Server error during login",
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout endpoint that clears authentication cookies and session
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
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * GET /api/auth/validate
 * Endpoint to validate if the current user is authenticated
 */
router.get("/validate", (req: Request, res: Response) => {
  const admin = (req as any).admin as AdminPayload | undefined;

  if (admin) {
    res.json({
      success: true,
      data: {
        username: admin.username,
        authenticated: true,
      },
    });
  } else {
    res.status(401).json({
      success: false,
      error: "Not authenticated",
    });
  }
});

export default router;
