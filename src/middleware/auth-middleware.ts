/**
 * Authentication middleware to verify JWT tokens
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Admin auth payload interface
interface AuthPayload {
  id: string;
  username: string;
}

/**
 * Middleware to verify JWT authentication tokens
 * Checks for token in Authorization header (Bearer token) or admin_token cookie
 */
export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : req.signedCookies?.admin_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Verify the token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret"
    ) as AuthPayload;

    // Add user info to request for use in route handlers
    (req as any).admin = decoded;

    // Continue to the protected route
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return res.status(401).json({
      success: false,
      error: "Invalid or expired authentication token",
    });
  }
};

/**
 * Middleware factory that creates a role-based access control middleware
 * @param allowedRoles Array of role names that are allowed to access the route
 */
export const requireRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // First verify the JWT token
      verifyJWT(req, res, (err) => {
        if (err) return next(err);

        // Token is valid, get the user's role from the admin object
        const admin = (req as any).admin;
        const role = admin.role || "admin"; // Default to 'admin' if no role specified

        // Check if user's role is in the allowed roles
        if (allowedRoles.includes(role)) {
          next();
        } else {
          res.status(403).json({
            success: false,
            error: "Insufficient permissions to access this resource",
          });
        }
      });
    } catch (error) {
      next(error);
    }
  };
};

export default { verifyJWT, requireRoles };
