/**
 * Application Constants
 * All configuration values and constants used across the application
 */

// 🔍 DEBUG: Log environment variables
console.log('🔍 Environment Variables Check:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  MODE:', process.env.MODE);
console.log('  PORT:', process.env.PORT);
console.log('  API_URL:', process.env.API_URL);
console.log('  API_KEY:', process.env.API_KEY ? '✅ Set' : '❌ Missing');
console.log('  COOKIE_ENCRYPTION_KEY:', process.env.COOKIE_ENCRYPTION_KEY ? '✅ Set' : '❌ Missing');
console.log('  LIMIT_API_URL:', process.env.LIMIT_API_URL || 'Using default');
console.log('  LIMIT_API_KEY:', process.env.LIMIT_API_KEY ? '✅ Set' : '❌ Missing');

// File Extensions
export const TEXT_EXTS = [
  '.html', '.htm', '.css', '.js', '.json', '.xml',
  '.txt', '.md', '.csv', '.svg'
];

export const TEXTUAL_PROXY_EXTENSIONS = [
  '.html', '.htm', '.css', '.js', '.json', '.xml',
  '.txt', '.svg', '.md'
];

export const BINARY_PROXY_EXTENSIONS = [
  '.pdf', '.xlsx', '.xls', '.docx', '.doc', '.zip',
  '.rar', '.7z', '.tar', '.gz'
];

export const STATIC_FILE_EXTENSIONS = [
  '.css', '.js', '.png', '.jpg', '.jpeg', '.gif',
  '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf',
  '.eot', '.otf', '.mp4', '.webm'
];

export const TEXTUAL_CONTENT_PREFIXES = [
  'text/',
  'application/json',
  'application/javascript',
  'application/xml'
];

// ✅ Download Limits per Plan (matches Python limits)
export const DOWNLOAD_LIMITS = {
  trial: parseInt(process.env.TRIAL_DOWNLOAD_LIMIT || '2', 10),
  default: parseInt(process.env.DEFAULT_DOWNLOAD_LIMIT || '10', 10), // ✅ Changed from 20 to 10
  pro: parseInt(process.env.PRO_DOWNLOAD_LIMIT || '50', 10),
  premium: parseInt(process.env.PREMIUM_DOWNLOAD_LIMIT || '100', 10)
};

// Log the limits being used
console.log('📊 Download Limits Configuration:');
console.log('  Trial:', DOWNLOAD_LIMITS.trial);
console.log('  Default:', DOWNLOAD_LIMITS.default);
console.log('  Pro:', DOWNLOAD_LIMITS.pro);
console.log('  Premium:', DOWNLOAD_LIMITS.premium);

// Cookie Configuration
export const COOKIE_EXPIRATION_HOURS = parseInt(
  process.env.COOKIE_EXPIRATION_HOURS || '1',
  10
);

export const COOKIE_CACHE_TTL_SECONDS = Math.max(
  parseInt(process.env.COOKIE_CACHE_TTL_SECONDS || '300', 10),
  0
);

// API Configuration
export const API_URL = process.env.API_URL;
export const API_KEY = process.env.API_KEY;

// ✅ Stats API Configuration (matches Python logic)
// In production, use internal Docker network URL
// In development, use public URL
export const LIMIT_API_URL = process.env.MODE === 'development'
  ? 'https://stats.toolszilla.net'  // ✅ Public URL for development
  : (process.env.LIMIT_API_URL || 'http://stats-api:4000'); // ✅ Docker internal URL for production

export const LIMIT_API_KEY = process.env.LIMIT_API_KEY || 'kjklj8u878jhh-ijiuju8u0bhdrteuoj-89ggffwedgh';

// Log the Stats API configuration
console.log('📡 Stats API Configuration:');
console.log('  URL:', LIMIT_API_URL);
console.log('  Key:', LIMIT_API_KEY ? '✅ Set' : '❌ Missing');

// User Agent
export const USER_AGENT = process.env.USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

// Admin Configuration
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'anees1234';
export const TOOL_COOKIES_RESET_KEY = process.env.TOOL_COOKIES_RESET_KEY || 'change_this_key';

// Encryption
export const COOKIE_ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY;

// Banned URL Paths
export const BANNED_URL_PATHS = process.env.BANNED_URL_PATHS || '';

// MIME Types Mapping 
export const MIME_TYPES = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

// Validate critical environment variables
const criticalVars = {
  API_URL,
  API_KEY,
  COOKIE_ENCRYPTION_KEY,
  LIMIT_API_KEY
};

const missingVars = Object.entries(criticalVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ CRITICAL: Missing required environment variables:', missingVars.join(', '));
  console.error('⚠️  Application may not function correctly!');
}