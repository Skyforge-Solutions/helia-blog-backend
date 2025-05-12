import { Request } from "express";

declare module "express" {
  interface Request {
    signedCookies: {
      admin_token?: string;
      [key: string]: any;
    };
  }
}
