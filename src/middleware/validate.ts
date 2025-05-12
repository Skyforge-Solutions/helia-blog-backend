// Request validation middleware
import { body, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

/**
 * Validation rules for blog submission
 * Ensures all required fields are present and properly formatted
 */
export const submitValidators = [
  // Title must be a string with length between 1 and 100
  body("title")
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title is required and must be between 1-100 characters"),

  // Content must be a string with length between 1 and 10000
  body("content")
    .isString()
    .isLength({ min: 1, max: 10000 })
    .withMessage("Content is required and must be between 1-10000 characters"),

  // Summary is optional but must be a string with max length 200
  body("summary")
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage("Summary must be a maximum of 200 characters"),

  // Author name must be a string with length between 1 and 50
  body("authorName")
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage("Author name is required and must be between 1-50 characters"),

  // Author email must be a valid email address
  body("authorEmail")
    .isEmail()
    .normalizeEmail()
    .withMessage("A valid email address is required"),
];

/**
 * Middleware to check validation results
 * Returns a 400 error with validation errors if any
 */
export function checkValidation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Validation failed",
        details: errors.array(),
      },
    });
  }
  next();
}
