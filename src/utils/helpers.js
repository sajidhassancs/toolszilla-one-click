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
  
  // Handle null/undefined
  if (!cookiesStr) {
    console.error('❌ Empty cookie string provided');
    return cookies;
  }

  // If it's already an object, return as-is
  if (typeof cookiesStr === 'object' && !Array.isArray(cookiesStr)) {
    return cookiesStr;
  }

  // If it's an array already (parsed JSON)
  if (Array.isArray(cookiesStr)) {
    console.log('📋 Parsing cookie array');
    for (const cookie of cookiesStr) {
      if (cookie && cookie.name) {
        cookies[cookie.name] = cookie.value;
      }
    }
    console.log(`✅ Parsed ${Object.keys(cookies).length} cookies from array`);
    return cookies;
  }

  // It's a string - try to parse as JSON first
  if (typeof cookiesStr === 'string') {
    const trimmed = cookiesStr.trim();
    
    // Check if it looks like JSON
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        console.log('📋 Attempting to parse as JSON...');
        const parsed = JSON.parse(trimmed);
        
        if (Array.isArray(parsed)) {
          console.log(`✅ Successfully parsed JSON array with ${parsed.length} cookies`);
          for (const cookie of parsed) {
            if (cookie && cookie.name) {
              cookies[cookie.name] = cookie.value;
            }
          }
          return cookies;
        } else if (typeof parsed === 'object') {
          console.log('✅ Successfully parsed JSON object');
          return parsed;
        }
      } catch (error) {
        console.error('❌ Failed to parse JSON cookies:', error.message);
        // Fall through to header string parsing
      }
    }

    // Parse as header string format (cookie1=value1; cookie2=value2)
    console.log('📋 Parsing as header string format');
    const parts = trimmed.split(';');
    for (const part of parts) {
      const [key, ...valueParts] = part.trim().split('=');
      if (key && valueParts.length) {
        cookies[key] = valueParts.join('=');
      }
    }
    console.log(`✅ Parsed ${Object.keys(cookies).length} cookies from string`);
    return cookies;
  }

  console.error('❌ Unknown cookie format:', typeof cookiesStr);
  return cookies;
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