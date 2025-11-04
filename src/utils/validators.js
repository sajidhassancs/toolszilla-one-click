/**
 * Validation Functions
 */

/**
 * Validate email format
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate auth token format
 */
export function isValidAuthToken(token) {
  return token && typeof token === 'string' && token.length > 10;
}

/**
 * Validate prefix format
 */
export function isValidPrefix(prefix) {
  return prefix && typeof prefix === 'string' && prefix.length > 0;
}

/**
 * Validate admin credentials
 */
export function validateAdminCredentials(username, password, validUsername, validPassword) {
  return username === validUsername && password === validPassword;
}

/**
 * Check if path is banned
 * @param {string} path - The URL path to check
 * @param {Array<string>} bannedPaths - Array of banned path segments from product config
 * @returns {boolean} - True if path is banned
 */
export function isPathBanned(path, bannedPaths) {
  // Get banned paths from environment variable
  const envBannedPaths = (process.env.BANNED_URL_PATHS || '')
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length > 0);
  
  // Combine product-specific banned paths with env banned paths
  const allBannedPaths = [...bannedPaths, ...envBannedPaths];
  
  // Normalize the path
  const lowerPath = path.toLowerCase().trim();
  const pathParts = lowerPath.split('/').filter(p => p);
  
  // Check each banned path
  for (const bannedPath of allBannedPaths) {
    const bannedLower = bannedPath.toLowerCase().trim();
    
    // Check if any path segment matches the banned path
    if (pathParts.includes(bannedLower)) {
      console.log(`🚫 Blocked: Path "${path}" contains banned segment "${bannedPath}"`);
      return true;
    }
    
    // Also check if the path starts with the banned path
    if (lowerPath === `/${bannedLower}` || lowerPath.startsWith(`/${bannedLower}/`)) {
      console.log(`🚫 Blocked: Path "${path}" starts with banned path "${bannedPath}"`);
      return true;
    }
  }
  
  return false;
}