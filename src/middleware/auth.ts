// Authentication middleware
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { cache } from "../utils/cache";

// Token cache TTL in seconds (5 minutes)
const TOKEN_CACHE_TTL = 300;

/**
 * Interface for JWT payload with admin username and ID
 */
export interface AdminPayload {
  username: string;
  id: string;
}

/**
 * Get a cache key for a JWT token
 */
function getTokenCacheKey(token: string): string {
  // Use the last 10 chars of the token to create the key (for privacy)
  const tokenFragment = token.slice(-10);
  return `jwt_token_${tokenFragment}`;
}

/**
 * Middleware to verify admin authentication
 * Checks session first, then falls back to cookie
 * Attaches the admin payload to the request object
 */
export function verifyJWT(req: Request, res: Response, next: NextFunction) {
  try {
    // First check if admin is authenticated in session
    if (req.session && (req.session as any).admin) {
      // Admin is already authenticated in session
      (req as any).admin = (req.session as any).admin;
      return next();
    }

    // If no session, check for the signed cookie
    const token = req.signedCookies.admin_token;

    if (!token) {
      // No cookie found, check for Authorization header as fallback for API clients
      const auth = req.headers.authorization;

      if (!auth || !auth.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        });
      }

      // Extract token from Authorization header
      const headerToken = auth.split(" ")[1];
      if (!headerToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid authentication token",
          },
        });
      }

      // Check cache for the token
      const cacheKey = getTokenCacheKey(headerToken);
      const cachedPayload = cache.get<AdminPayload>(cacheKey);

      if (cachedPayload) {
        // Use cached payload
        (req as any).admin = cachedPayload;

        // Store in session for future requests
        if (req.session) {
          (req.session as any).admin = cachedPayload;
        }

        return next();
      }

      // Verify token from Authorization header
      const payload = jwt.verify(
        headerToken,
        process.env.JWT_SECRET!
      ) as AdminPayload;

      // Cache the token payload
      cache.set(cacheKey, payload, TOKEN_CACHE_TTL);

      // Store in session for future requests
      if (req.session) {
        (req.session as any).admin = payload;
      }

      // Attach to request
      (req as any).admin = payload;

      return next();
    }

    // Check cache for the cookie token
    const cacheKey = getTokenCacheKey(token);
    const cachedPayload = cache.get<AdminPayload>(cacheKey);

    if (cachedPayload) {
      // Use cached payload
      (req as any).admin = cachedPayload;

      // Store in session for future requests
      if (req.session) {
        (req.session as any).admin = cachedPayload;
      }

      return next();
    }

    // Verify the JWT token from cookie
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AdminPayload;

    // Cache the verified token payload
    cache.set(cacheKey, payload, TOKEN_CACHE_TTL);

    // Store in session for future requests
    if (req.session) {
      (req.session as any).admin = payload;
    }

    // Attach admin info to request
    (req as any).admin = payload;

    next();
  } catch (error) {
    // Return error if token is invalid
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid authentication token",
      },
    });
  }
}
