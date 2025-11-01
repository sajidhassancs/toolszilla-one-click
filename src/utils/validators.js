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
 */
export function isPathBanned(path, bannedPaths) {
  const pathParts = path.split('/').filter(p => p);
  
  for (const bannedPath of bannedPaths) {
    if (pathParts.includes(bannedPath)) {
      return true;
    }
  }
  
  return false;
}