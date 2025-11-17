/**
 * Limit Service
 * Handles download limit checking and tracking
 */
import { checkDownloadLimit, addDownloadRecord } from './apiService.js';
import { getUserIp } from '../utils/helpers.js';
import { DOWNLOAD_LIMITS } from '../utils/constants.js';

/**
 * Check if user can download (hasn't reached limit)
 */
export async function canUserDownload(req, toolName, userEmail, plan = 'default') {
  try {
    // Get current download count
    const result = await checkDownloadLimit(toolName, userEmail);

    if (!result.success) {
      console.error('❌ Failed to check download limit');
      // ✅ CHANGED: Return allowed: true (fail-open)
      return {
        allowed: true,  // ✅ Changed from false to true
        count: 0,
        limit: DOWNLOAD_LIMITS[plan] || DOWNLOAD_LIMITS.default,
        error: 'Failed to check limit'
      };
    }

    const downloadCount = result.count;
    const limit = DOWNLOAD_LIMITS[plan] || DOWNLOAD_LIMITS.default;

    console.log(`📊 Download check: ${downloadCount}/${limit} (Plan: ${plan})`);

    return {
      allowed: downloadCount < limit,
      count: downloadCount,
      limit: limit
    };
  } catch (error) {
    console.error('❌ Error checking download limit:', error.message);
    // ✅ CHANGED: Return allowed: true (fail-open)
    return {
      allowed: true,  // ✅ Changed from false to true
      count: 0,
      limit: DOWNLOAD_LIMITS[plan] || DOWNLOAD_LIMITS.default,
      error: error.message
    };
  }
}

/**
 * Record a download
 */
export async function recordDownload(req, toolName, userEmail, info = null) {
  try {
    const userIp = getUserIp(req);
    const website = req.hostname;

    const result = await addDownloadRecord(
      toolName,
      userEmail,
      website,
      userIp,
      info
    );

    if (result.success) {
      console.log(`✅ Download recorded for ${userEmail}`);
      return true;
    } else {
      console.error('❌ Failed to record download');
      return false;
    }
  } catch (error) {
    console.error('❌ Error recording download:', error.message);
    return false;
  }
}

/**
 * Check or add download (combined function for backward compatibility)
 */
export async function checkOrAddDownload(req, toolName, userEmail, plan, addDownload = false, info = null) {
  if (addDownload) {
    // Add download record
    return await recordDownload(req, toolName, userEmail, info);
  } else {
    // Check download limit
    const result = await canUserDownload(req, toolName, userEmail, plan);
    return [result.allowed, result.count, result.limit];
  }
}