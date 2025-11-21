/**
 * Session Cache Service
 * Caches validated sessions to avoid repeated decryption/API calls
 */

const sessionCache = new Map();
const dashboardValidationCache = new Map();

const CACHE_TTL = 30000; // 30 seconds
const DASHBOARD_CHECK_TTL = 15000; // 15 seconds

/**
 * Get cached session
 */
export function getCachedSession(cookieFingerprint) {
    const cached = sessionCache.get(cookieFingerprint);

    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
        sessionCache.delete(cookieFingerprint);
        return null;
    }

    return cached.data;
}

/**
 * Set cached session
 */
export function setCachedSession(cookieFingerprint, sessionData) {
    sessionCache.set(cookieFingerprint, {
        data: sessionData,
        expiresAt: Date.now() + CACHE_TTL
    });
}

/**
 * Get cached dashboard validation
 */
export function getCachedDashboardValidation(email, authToken) {
    const cacheKey = `${email}_${authToken}`;
    const cached = dashboardValidationCache.get(cacheKey);

    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
        dashboardValidationCache.delete(cacheKey);
        return null;
    }

    return cached.isValid;
}

/**
 * Set cached dashboard validation
 */
export function setCachedDashboardValidation(email, authToken, isValid) {
    const cacheKey = `${email}_${authToken}`;
    dashboardValidationCache.set(cacheKey, {
        isValid: isValid,
        expiresAt: Date.now() + DASHBOARD_CHECK_TTL
    });
}

/**
 * Clear all session cache
 */
export function clearAllSessionCache() {
    sessionCache.clear();
    dashboardValidationCache.clear();
    console.log('✅ Session caches cleared');
}

/**
 * Get cache statistics
 */
export function getSessionCacheStats() {
    return {
        sessions: sessionCache.size,
        dashboardValidations: dashboardValidationCache.size
    };
}