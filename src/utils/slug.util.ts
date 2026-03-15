/**
 * Utility for slug generation and sanitization with Arabic transliteration support.
 */

const arabicToEnglishMap: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
  'ة': 'a', 'ئ': 'e', 'ء': 'a', 'ؤ': 'u',
  ' ': '-', '_': '-',
};

/**
 * Transliterates Arabic characters to English equivalents.
 */
function transliterate(text: string): string {
  return text
    .split('')
    .map(char => arabicToEnglishMap[char] || char)
    .join('');
}

/**
 * Generates a URL-safe slug from a string, supporting Arabic.
 */
export function generateSlug(text: string): string {
  const transliterated = transliterate(text.toLowerCase().trim());
  return transliterated
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Sanitizes an existing slug to ensure it only contains safe characters.
 * Removes Arabic characters as they should be transliterated during generation.
 */
export function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/[\u0600-\u06FF]/g, '') // remove remaining Arabic
    .replace(/[^a-z0-9-]/g, '')      // keep only safe chars
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
