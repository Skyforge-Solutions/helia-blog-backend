// Custom type definitions
import { Request } from "express";
import { AdminPayload } from "../src/middleware/auth";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
    }
  }
}

export {};
