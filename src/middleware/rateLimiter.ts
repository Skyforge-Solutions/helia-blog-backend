// Rate limiting middleware
import rateLimit from "express-rate-limit";
import { Request } from "express";

/**
 * Rate limiter for blog submission endpoint
 * Limits submissions to 3 per hour based on IP address
 * Optimized for performance with in-memory store
 */
export const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 submissions per hour
  standardHeaders: true,
  legacyHeaders: false,
  // Optimized options
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: true, // Don't count failed requests
  // Only use the first part of the IP for privacy and performance in development
  keyGenerator: (req: Request) => {
    const ip = req.ip || "unknown";

    // In development, accept any IP
    if (process.env.NODE_ENV !== "production") {
      return ip;
    }

    // In production, for IPv4, use first three octets (e.g., 123.123.123.xxx)
    if (ip.includes(".")) {
      const parts = ip.split(".");
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }

    // For IPv6, use first four groups
    if (ip.includes(":")) {
      const parts = ip.split(":");
      return parts.slice(0, 4).join(":");
    }

    return ip;
  },
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many blog submissions. Please try again later.",
      },
    }),
  // Use a more efficient in-memory store by default
  // This avoids file system operations or external store dependencies
  store: undefined, // Use default memory store
});
