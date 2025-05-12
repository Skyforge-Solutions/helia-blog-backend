/**
 * Admin authentication routes with TypeScript type safety
 */
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { withClient } from "../db";

const router = express.Router();

// Define admin types
interface AdminData {
  id: string;
  username: string;
  password: string;
  created_at: Date;
  last_login: Date | null;
}

interface AdminPayload {
  id: string;
  username: string;
}

// Type augmentation for express session
declare module "express-session" {
  interface SessionData {
    admin?: AdminPayload;
  }
}

// Login route
router.post("/login", async (req: Request, res: Response) => {
  try {
    // Type as unknown and then as specific type
    const username = (req.body as any)?.username || "";
    const password = (req.body as any)?.password || "";

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Variable to store admin data if found
    let admin: AdminData | null = null;

    // Find admin user in database
    await withClient(async (client) => {
      const query = "SELECT * FROM admins WHERE username = $1 LIMIT 1";
      const result = await client.query(query, [username]);

      if (result.rows.length > 0) {
        // Map fields explicitly to avoid type issues
        const row = result.rows[0];
        admin = {
          id: row.id,
          username: row.username,
          password: row.password,
          created_at: row.created_at,
          last_login: row.last_login,
        };
      }
    });

    // Admin not found
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password
    const passwordToCheck = admin.password;
    const isValidPassword = await bcrypt.compare(password, passwordToCheck);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login time - admin is guaranteed to be non-null at this point
    const adminId = admin.id;
    const adminUsername = admin.username;

    await withClient(async (client) => {
      await client.query("UPDATE admins SET last_login = NOW() WHERE id = $1", [
        adminId,
      ]);
    });

    // Create authentication payload
    const payload: AdminPayload = {
      id: adminId,
      username: adminUsername,
    };

    // Create and set JWT cookie
    res.cookie(
      "admin_token",
      jwt.sign(payload, process.env.JWT_SECRET || "secret_key", {
        expiresIn: "30m",
      }),
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
      req.session.admin = payload;
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

// Logout route
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

  return res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// Validation route
router.get("/validate", (req: Request, res: Response) => {
  const admin = (req as any).admin as AdminPayload | undefined;

  if (admin && admin.username) {
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
