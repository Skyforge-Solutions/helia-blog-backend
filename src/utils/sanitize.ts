// HTML sanitization utility
import sanitizeHtml from "sanitize-html";

// Define sanitization options once for better performance
const SANITIZE_OPTIONS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1"]),
  allowedAttributes: {
    "*": ["href", "align", "alt", "src"],
  },
  // Additional performance optimizations
  parser: {
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  },
  // Skip text filtering for performance
  textFilter: undefined,
};

/**
 * Sanitizes HTML input to prevent XSS attacks
 * Allows some safe HTML tags and attributes
 * Optimized for performance
 */
export function sanitize(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
