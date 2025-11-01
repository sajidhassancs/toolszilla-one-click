/**
 * Helper Utility Functions
 */
import path from 'path';
import { MIME_TYPES, TEXTUAL_PROXY_EXTENSIONS, BINARY_PROXY_EXTENSIONS, TEXTUAL_CONTENT_PREFIXES } from './constants.js';

/**
 * Get MIME type from file path
 */
export function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Check if content should be decoded as text
 */
export function shouldDecodeAsText(lowerPath, contentType) {
  // Check for binary extensions first
  for (const ext of BINARY_PROXY_EXTENSIONS) {
    if (lowerPath.endsWith(ext)) {
      return false;
    }
  }

  // Check for textual extensions
  for (const ext of TEXTUAL_PROXY_EXTENSIONS) {
    if (lowerPath.endsWith(ext)) {
      return true;
    }
  }

  // Check content type
  for (const prefix of TEXTUAL_CONTENT_PREFIXES) {
    if (contentType.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Get user IP address from request
 */
export function getUserIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
}

/**
 * Check if timestamp is expired
 */
export function isExpired(timestamp, expirationHours) {
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = currentTime - timestamp;
  const expirationLimit = expirationHours * 3600;
  return timeDiff > expirationLimit;
}

/**
 * Parse cookies from string to object
 */
export function parseCookieString(cookiesStr) {
  const cookies = {};
  
  try {
    // Try parsing as JSON array first
    const cookiesArray = JSON.parse(cookiesStr);
    for (const cookie of cookiesArray) {
      cookies[cookie.name] = cookie.value;
    }
    return cookies;
  } catch {
    // Parse as key=value pairs
    const parts = cookiesStr.split('; ');
    for (const part of parts) {
      const [key, ...valueParts] = part.split('=');
      if (key && valueParts.length) {
        cookies[key] = valueParts.join('=');
      }
    }
    return cookies;
  }
}

/**
 * Convert cookies object to Cookie header string
 */
export function cookiesToString(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Format date to Pakistan timezone
 */
export function formatDatePKT(date = new Date()) {
  return date.toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}