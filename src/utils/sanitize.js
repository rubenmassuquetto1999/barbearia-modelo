/**
 * DevSecOps Input Sanitizer and Validation Utility
 */

export function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Strip < and > to prevent basic HTML/XSS injection
    .trim();
}

export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      clean[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeObject(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && re.test(email.toLowerCase().trim());
}

export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

export function validateDateFormat(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export function validateTimeFormat(timeStr) {
  return typeof timeStr === 'string' && /^\d{2}:\d{2}$/.test(timeStr);
}

export function formatPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}
