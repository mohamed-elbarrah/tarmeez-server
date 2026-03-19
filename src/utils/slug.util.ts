/**
 * Utility for slug generation and sanitization.
 * Arabic names are preserved as-is (spaces → hyphens).
 * Latin names are lowercased.
 *
 * Examples:
 *   'هاتف ذكي متطور' → 'هاتف-ذكي-متطور'
 *   'iPhone 15 Pro'  → 'iphone-15-pro'
 *   'منتج مميز 2024' → 'منتج-مميز-2024'
 */

/**
 * Generates a URL-safe slug from a string.
 * Preserves Arabic characters — does NOT transliterate.
 */
export function generateSlug(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '-')
    // Keep Arabic letters (basic + extended), Latin alphanumeric, digits, hyphens
    .replace(/[^\u0600-\u06FF\u0750-\u077Fa-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Sanitizes an existing slug — same rules as generateSlug.
 */
export function sanitizeSlug(slug: string): string {
  return generateSlug(slug);
}
