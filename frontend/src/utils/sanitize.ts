import DOMPurify from 'dompurify';

/**
 * Sanitize user-generated text before rendering in the UI.
 * Strips all HTML tags and attributes, returning plain text only.
 */
export function sanitize(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
