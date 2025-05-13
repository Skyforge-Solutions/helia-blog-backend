// Protected admin routes
import { Router, Request, Response } from "express";
import { db, withClient } from "../db";
import { blogs } from "../schema";
import { eq, sql } from "drizzle-orm";
import { verifyJWT } from "../middleware/auth-middleware";
import { cache } from "../utils/cache";

const router = Router();

// Cache TTL constants
const STATS_CACHE_TTL = 60; // 1 minute cache for statistics

// Individual routes with JWT verification

/**
 * GET /api/admin/blogs
 * Get blog posts with pagination and filtering by status
 * Query parameters:
 *   - page: page number (default 1)
 *   - limit: number of posts per page (default 10)
 *   - status: filter by status (default 'pending')
 */
router.get(
  "/blogs",
  verifyJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Parse query parameters
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const status = (req.query.status as string) || "pending";

      // Get blogs and count in parallel
      const [rows, countResult] = await Promise.all([
        db
          .select()
          .from(blogs)
          .where(eq(blogs.status, status))
          .limit(limit)
          .offset(offset)
          .execute(),

        db
          .select({ count: sql`count(*)` })
          .from(blogs)
          .where(eq(blogs.status, status))
          .execute(),
      ]);

      // Parse count result
      const totalCount = Number(countResult[0]?.count || 0);

      // Return results with pagination info
      res.json({
        success: true,
        data: rows,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An error occurred while fetching blogs",
        },
      });
    }
  }
);

/**
 * GET /api/admin/blogs/:id
 * Get a single blog post by ID (admin can view blogs regardless of status)
 */
router.get(
  "/blogs/:id",
  verifyJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;

      // Get the blog by ID
      const row = await db
        .select()
        .from(blogs)
        .where(eq(blogs.id, id))
        .limit(1)
        .execute();

      // Check if blog exists
      if (!row.length) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Blog post not found",
          },
        });
        return;
      }

      // Return the blog
      res.json({
        success: true,
        data: row[0],
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An error occurred while fetching the blog post",
        },
      });
    }
  }
);

/**
 * PUT /api/admin/blogs/:id/content
 * Update blog content
 */
router.put(
  "/blogs/:id/content",
  verifyJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const { content } = req.body;

      // Validate content
      if (!content) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_CONTENT",
            message: "Content is required",
          },
        });
        return;
      }

      // Update blog content
      const updated = await db
        .update(blogs)
        .set({
          content,
          lastModified: new Date(),
        })
        .where(eq(blogs.id, id))
        .returning()
        .execute();

      // Check if blog exists
      if (!updated.length) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Blog post not found",
          },
        });
        return;
      }

      // Return updated blog
      res.json({
        success: true,
        data: updated[0],
        message: "Blog content updated successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An error occurred while updating blog content",
        },
      });
    }
  }
);

/**
 * PUT /api/admin/blogs/:id/status
 * Update blog status (approve or reject)
 */
router.put(
  "/blogs/:id/status",
  verifyJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const { status, adminNotes } = req.body;

      // Validate status
      if (!["approved", "rejected"].includes(status)) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: 'Status must be either "approved" or "rejected"',
          },
        });
        return;
      }

      // Update blog status
      const updated = await db
        .update(blogs)
        .set({
          status,
          adminNotes: adminNotes || null,
          approvalDate: status === "approved" ? new Date() : null,
          lastModified: new Date(),
        })
        .where(eq(blogs.id, id))
        .returning()
        .execute();

      // Check if blog exists
      if (!updated.length) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Blog post not found",
          },
        });
        return;
      }

      // Return updated blog
      res.json({
        success: true,
        data: updated[0],
        message: `Blog post ${
          status === "approved" ? "approved" : "rejected"
        } successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An error occurred while updating blog status",
        },
      });
    }
  }
);

/**
 * DELETE /api/admin/blogs/:id
 * Delete a blog post
 */
router.delete(
  "/blogs/:id",
  verifyJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;

      // Delete blog
      const deleted = await db
        .delete(blogs)
        .where(eq(blogs.id, id))
        .returning()
        .execute();

      // Check if blog exists
      if (!deleted.length) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Blog post not found",
          },
        });
        return;
      }

      // Return success
      res.json({
        success: true,
        message: "Blog post deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An error occurred while deleting the blog post",
        },
      });
    }
  }
);

/**
 * GET /api/admin/stats
 * Get blog statistics with caching
 */
router.get(
  "/stats",
  verifyJWT,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Try to get stats from cache first
      const cacheKey = "blog_stats";
      const cachedStats = cache.get(cacheKey);

      if (cachedStats) {
        // Return cached stats if available
        res.json({
          success: true,
          data: cachedStats,
          source: "cache",
        });
        return;
      }

      // Cache miss - get stats from database using withClient for safer queries
      let stats;
      try {
        // Use withClient to ensure proper connection release
        await withClient(async (client) => {
          const result = await client.query(
            "SELECT status, COUNT(*) FROM blogs GROUP BY status"
          );
          stats = result.rows;
        });
      } catch (dbError) {
        console.error("Database error while fetching statistics:", dbError);
        throw new Error("Database connection error");
      }

      // Cache the stats
      cache.set(cacheKey, stats, STATS_CACHE_TTL);

      // Return stats from database
      res.json({
        success: true,
        data: stats,
        source: "database",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An error occurred while fetching blog statistics",
        },
      });
    }
  }
);

export default router;
 