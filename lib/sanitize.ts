export const sanitizeText = (text: string): string => {
  if (!text) return '';
  return text
    // Fix broken bullets
    .replace(/[\uFFFD\u25A0\u25FC]/g, '•')
    // Fix ?₱ → ₱
    .replace(/\?(\d{1,3}(?:,\d{3})*)/g, '₱$1')
    // Fix dimension separators
    .replace(/[\uFFFD]x[\uFFFD]/g, 'x')
    .replace(/[\uFFFD](\d)/g, 'x$1')
    // Collapse multiple replacement chars
    .replace(/[\uFFFD]+/g, '•')
    .trim();
};
