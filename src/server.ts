// Main application entrypoint
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cluster from "cluster";
import os from "os";
import cookieParser from "cookie-parser";
import session from "express-session";
import { init as initDb, closeDatabase } from "./db";
import blogRoutes from "./routes/blog";
// import authRoutes from "./routes/auth"; // Old auth routes with type problems
import adminRoutes from "./routes/admin";
// import adminAuthRoutes from "./routes/admin-routes"; // New admin auth routes with TS issues

// Import JavaScript version of admin auth routes
// @ts-ignore - Allow JS module import
const adminAuthRoutes = require("./routes/admin-auth.js");

// Determine the number of CPU cores to use (leave one for the OS)
const numCPUs = Math.max(1, os.cpus().length - 1);

/**
 * Start the Express server with middleware and routes
 */
async function startServer() {
  console.log("🔧 Starting server...");

  // Initialize database
  try {
    await initDb();
    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    process.exit(1);
  }

  // Create Express app
  const app = express();

  // Apply global middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true, // Allow cookies to be sent with requests
    })
  );

  // Increase JSON payload limit and use non-blocking compression
  app.use(express.json({ limit: "10kb" }));

  // Add cookie parser middleware
  app.use(cookieParser(process.env.JWT_SECRET)); // Use JWT secret for signing cookies

  // Add session middleware
  app.use(
    session({
      secret: process.env.JWT_SECRET || "admin-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
        httpOnly: true, // Prevent JavaScript access to cookies
        maxAge: 30 * 60 * 1000, // 30 minutes (same as JWT)
        sameSite: "lax", // Allow cookies from same site
      },
    })
  );

  // Log requests in development
  if (process.env.NODE_ENV !== "production") {
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  // Register routes
  try {
    app.use("/api/auth", adminAuthRoutes); // Use JS admin auth routes
    app.use("/api/blogs", blogRoutes);
    app.use("/api/admin", adminRoutes);
    console.log("✅ Routes registered successfully");
  } catch (error) {
    console.error("❌ Error registering routes:", error);
    // Continue startup despite route errors
  }

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      pid: process.pid,
      cpus: numCPUs,
    });
  });

  // Database connection test endpoint
  app.get("/api/db-test", async (req, res) => {
    try {
      // Import the withClient function for proper connection handling
      const { withClient } = await import("./db");

      // Test the database connection with proper client release
      await withClient(async (client) => {
        const result = await client.query("SELECT NOW() as time");
        res.json({
          success: true,
          dbTime: result.rows[0].time,
          message: "Database connection test successful",
        });
      });
    } catch (error) {
      console.error("Database test error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "DB_ERROR",
          message: "Database connection test failed",
        },
      });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
      },
    });
  });

  // Global error handler
  app.use(
    (
      error: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      console.error("Unhandled error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An unexpected error occurred",
        },
      });
    }
  );

  // Start the server
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    console.log(`🚀 Worker ${process.pid} running on http://localhost:${port}`);
  });

  // Setup graceful shutdown
  setupGracefulShutdown(server);

  return server;
}

/**
 * Setup graceful shutdown to close database connections and server
 */
function setupGracefulShutdown(server: any) {
  // Handle graceful shutdown for SIGTERM and SIGINT
  const shutdown = async () => {
    console.log("💤 Graceful shutdown initiated...");

    // Close the server first (stop accepting new connections)
    server.close(() => {
      console.log("✅ HTTP server closed");
    });

    try {
      // Close database connections
      await closeDatabase();
      console.log("✅ Graceful shutdown completed");
      process.exit(0);
    } catch (err) {
      console.error("❌ Error during shutdown:", err);
      process.exit(1);
    }
  };

  // Listen for termination signals
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

/**
 * Main entry point - set up clustering in production,
 * or just start a single server in development
 */
async function start() {
  if (cluster.isPrimary && process.env.NODE_ENV === "production") {
    console.log(`🧠 Primary ${process.pid} is running`);
    console.log(`🔄 Starting ${numCPUs} workers...`);

    // Fork workers equal to number of CPUs
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    // Handle worker crashes
    cluster.on("exit", (worker, code, signal) => {
      console.log(`⚠️ Worker ${worker.process.pid} died`);
      console.log("🔄 Starting a new worker...");
      cluster.fork();
    });

    // Handle primary process termination
    process.on("SIGTERM", async () => {
      console.log("🛑 Primary process terminating, stopping all workers");

      // Get all workers
      const workers = Object.values(cluster.workers || {});

      // Send a message to all workers to shut down gracefully
      for (const worker of workers) {
        worker?.send("shutdown");
      }

      // Wait for workers to exit, or force kill after timeout
      const forceKillTimeout = setTimeout(() => {
        console.log("⚠️ Forcing worker termination after timeout");
        for (const worker of workers) {
          worker?.kill("SIGKILL");
        }
      }, 5000);

      cluster.on("exit", () => {
        if (Object.keys(cluster.workers || {}).length === 0) {
          clearTimeout(forceKillTimeout);
          console.log("✅ All workers terminated, exiting primary");
          process.exit(0);
        }
      });
    });
  } else {
    // Worker processes or development mode - start server
    const server = await startServer();

    // Listen for shutdown message from primary
    process.on("message", async (msg) => {
      if (msg === "shutdown") {
        console.log(`🛑 Worker ${process.pid} received shutdown message`);

        // Close HTTP server and database connections
        server.close(async () => {
          await closeDatabase();
          process.exit(0);
        });
      }
    });
  }
}

// Start the server and handle errors
start().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
