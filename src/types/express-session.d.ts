import "express-session";

// Define the admin payload interface inline to avoid circular dependencies
interface AdminPayload {
  username: string;
  id: string;
}

declare module "express-session" {
  interface SessionData {
    admin?: AdminPayload;
  }
}
