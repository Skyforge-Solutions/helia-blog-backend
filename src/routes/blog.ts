// Public blog routes
import { Router, Request, Response } from "express";
import { db } from "../db";
import { blogs } from "../schema";
import { eq, lt, desc, sql, and } from "drizzle-orm";
import { submitLimiter } from "../middleware/rateLimiter";
import { submitValidators, checkValidation } from "../middleware/validate";
import { sanitize } from "../utils/sanitize";
import { cache } from "../utils/cache";
import crypto from "crypto";

const router = Router();

// Cache TTL constants
const LIST_CACHE_TTL = 30; // 30 seconds cache for listings
const POST_CACHE_TTL = 60; // 1 minute cache for single posts

// Type definitions for cached data
type BlogListCacheData = {
  rows: any[];
  nextCursor: string | null;
};

type BlogPostCacheData = {
  id: string;
  views: number;
  [key: string]: any;
};

/**
 * Get a cache key for blog listings
 */
function getBlogListCacheKey(
  limit: number,
  cursor?: string,
  sort?: string
): string {
  return `blog_list_${limit}_${cursor || "none"}_${sort || "default"}`;
}

/**
 * Get a cache key for a single blog post
 */
function getBlogPostCacheKey(id: string): string {
  return `blog_post_${id}`;
}

/**
 * GET /api/blogs
 * Get approved blog posts with pagination and caching
 * Query parameters:
 *   - limit: number of posts to return (default 10, max 50)
 *   - cursor: timestamp to start from (for pagination)
 *   - sort: field to sort by (default by submissionDate, can be 'views')
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    // Parse query parameters
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string | undefined;
    const sortField = req.query.sort === "views" ? "views" : "submissionDate";

    // Try to get from cache first
    const cacheKey = getBlogListCacheKey(limit, cursor, sortField);
    const cachedData = cache.get<BlogListCacheData>(cacheKey);

    if (cachedData) {
      // Return cached data
      res.json({
        success: true,
        data: cachedData.rows,
        pagination: { nextCursor: cachedData.nextCursor },
        source: "cache",
      });
      return;
    }

    // Cache miss - query database
    // Build and execute query with conditions
    const conditions = cursor
      ? and(
          eq(blogs.status, "approved"),
          lt(blogs.submissionDate, new Date(cursor))
        )
      : eq(blogs.status, "approved");

    const rows = await db
      .select()
      .from(blogs)
      .where(conditions)
      .orderBy(
        sortField === "views" ? desc(blogs.views) : desc(blogs.submissionDate)
      )
      .limit(limit)
      .execute();

    // Get next cursor for pagination
    const nextCursor = rows.length
      ? rows[rows.length - 1].submissionDate.toISOString()
      : null;

    // Cache the result
    const cacheData: BlogListCacheData = { rows, nextCursor };
    cache.set(cacheKey, cacheData, LIST_CACHE_TTL);

    // Return results
    res.json({
      success: true,
      data: rows,
      pagination: { nextCursor },
      source: "database",
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
});

/**
 * GET /api/blogs/:id
 * Get a single blog post by ID and increment view count
 * Uses caching with cache invalidation on view count updates
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const cacheKey = getBlogPostCacheKey(id);

  try {
    // For performance, we'll use a two-phase approach:
    // 1. First check if we have a cached version to return quickly
    // 2. In the background, still update the view count and refresh cache

    // Check cache first for immediate response
    const cachedBlog = cache.get<BlogPostCacheData>(cacheKey);

    if (cachedBlog) {
      // Return cached data immediately
      res.json({
        success: true,
        data: {
          ...cachedBlog,
          // Optimistically increment view count in response
          views: cachedBlog.views + 1,
        },
        source: "cache",
      });

      // Then update the view count in the background
      // This is non-blocking and happens after response is sent
      db.transaction(async (tx) => {
        await tx
          .update(blogs)
          .set({ views: sql`${blogs.views} + 1` })
          .where(eq(blogs.id, id))
          .execute();

        // Fetch updated blog to refresh cache
        const [updated] = await tx
          .select()
          .from(blogs)
          .where(and(eq(blogs.id, id), eq(blogs.status, "approved")))
          .limit(1)
          .execute();

        if (updated) {
          // Update cache with new data
          cache.set(cacheKey, updated, POST_CACHE_TTL);
        }
      }).catch((err) => console.error("Background view update failed:", err));

      return;
    }

    // Cache miss - do it the traditional way
    // Use transaction to update views and get blog
    await db.transaction(async (tx) => {
      // Increment view count
      await tx
        .update(blogs)
        .set({ views: sql`${blogs.views} + 1` })
        .where(eq(blogs.id, id))
        .execute();
    });

    // Get the blog with combined conditions
    const row = await db
      .select()
      .from(blogs)
      .where(and(eq(blogs.id, id), eq(blogs.status, "approved")))
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

    // Cache for future requests
    cache.set(cacheKey, row[0], POST_CACHE_TTL);

    // Return the blog
    res.json({
      success: true,
      data: row[0],
      source: "database",
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
});

/**
 * POST /api/blogs/submit
 * Submit a new blog post
 * Rate limited to 3 submissions per hour based on IP address
 */
router.post(
  "/submit",
  submitLimiter as any,
  submitValidators as any,
  checkValidation as any,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Get client IP and hash it for privacy
      const ip = req.ip || "127.0.0.1";
      const hashedIp = crypto.createHash("sha256").update(ip).digest("hex");

      // Extract validated data from request
      const { title, content, summary, authorName, authorEmail } = req.body;

      // Sanitize HTML content
      const cleanContent = sanitize(content);

      // Insert into database
      const inserted = await db
        .insert(blogs)
        .values({
          title,
          content: cleanContent,
          summary,
          authorName,
          authorEmail,
          ipAddress: hashedIp,
          adminIpAddress: ip, // Store original IP for admin access
        })
        .returning()
        .execute();

      // Return success with inserted data
      res.status(201).json({
        success: true,
        data: inserted[0],
        message: "Blog post submitted successfully and awaiting approval",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An error occurred while submitting the blog post",
        },
      });
    }
  }
);

export default router;
