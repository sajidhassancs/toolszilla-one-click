/**
 * Cache Service
 * In-memory caching for cookies, files, and sessions
 */

// In-memory caches
const caches = {
  premiumCookies: {},      // Premium cookies from API
  decryptedSessions: {},   // Decrypted user sessions
  staticFiles: {},         // Static files (CSS, JS, images)
  staticPages: {}          // HTML pages
};

/**
 * Set cache with optional TTL
 */
export function setCache(cacheType, key, value, ttl = null) {
  if (!caches[cacheType]) {
    console.error(`❌ Invalid cache type: ${cacheType}`);
    return false;
  }

  const cacheEntry = {
    data: value,
    expiresAt: ttl ? Date.now() + (ttl * 1000) : null
  };

  caches[cacheType][key] = cacheEntry;
  return true;
}

/**
 * Get cache value
 */
export function getCache(cacheType, key) {
  if (!caches[cacheType]) {
    return null;
  }

  const cacheEntry = caches[cacheType][key];
  
  if (!cacheEntry) {
    return null;
  }

  // Check if expired
  if (cacheEntry.expiresAt && Date.now() > cacheEntry.expiresAt) {
    delete caches[cacheType][key];
    return null;
  }

  return cacheEntry.data;
}

/**
 * Delete specific cache entry
 */
export function deleteCache(cacheType, key) {
  if (caches[cacheType] && caches[cacheType][key]) {
    delete caches[cacheType][key];
    return true;
  }
  return false;
}

/**
 * Clear entire cache type
 */
export function clearCacheType(cacheType) {
  if (caches[cacheType]) {
    caches[cacheType] = {};
    return true;
  }
  return false;
}

/**
 * Clear all caches
 */
export function clearAllCaches() {
  Object.keys(caches).forEach(cacheType => {
    caches[cacheType] = {};
  });
  console.log('✅ All caches cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const stats = {};
  
  Object.keys(caches).forEach(cacheType => {
    stats[cacheType] = Object.keys(caches[cacheType]).length;
  });
  
  return stats;
}