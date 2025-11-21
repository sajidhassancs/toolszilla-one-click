/**
 * Limit Service
 * Handles download limit checking and tracking (matches Python flow)
 */
import { checkDownloadLimit, addDownloadRecord } from './apiService.js';
import { getUserIp } from '../utils/helpers.js';
import { DOWNLOAD_LIMITS } from '../utils/constants.js';

/**
 * Check if user can download (matches Python logic)
 */
export async function canUserDownload(req, toolName, userEmail, plan = 'default') {
  try {
    // Get current download count from stats API (same as Python)
    const result = await checkDownloadLimit(toolName, userEmail);

    if (!result.success) {
      console.error('❌ Failed to check download limit');
      // ✅ Fail-open: Allow download on error (same as Python)
      return {
        allowed: true,
        count: 0,
        limit: DOWNLOAD_LIMITS[plan] || DOWNLOAD_LIMITS.default,
        error: 'Failed to check limit'
      };
    }

    const downloadCount = result.count || 0;
    const limit = DOWNLOAD_LIMITS[plan] || DOWNLOAD_LIMITS.default;

    console.log(`📊 [${toolName}] Current: ${downloadCount}/${limit} (Plan: ${plan})`);

    return {
      allowed: downloadCount < limit,
      count: downloadCount,
      limit: limit
    };
  } catch (error) {
    console.error('❌ Error checking download limit:', error.message);
    // ✅ Fail-open: Allow download on error (same as Python)
    return {
      allowed: true,
      count: 0,
      limit: DOWNLOAD_LIMITS[plan] || DOWNLOAD_LIMITS.default,
      error: error.message
    };
  }
}

/**
 * Record a download (matches Python add_download logic)
 */
export async function recordDownload(req, toolName, userEmail, plan = 'default', info = null) {
  try {
    const userIp = getUserIp(req);
    const website = req.hostname || req.get('host');

    // Build info object with plan
    const recordInfo = info || {};
    recordInfo.plan = plan;

    const result = await addDownloadRecord(
      toolName,
      userEmail,
      website,
      userIp,
      recordInfo
    );

    if (result.success) {
      console.log(`✅ [${toolName}] Download recorded for ${userEmail} (Plan: ${plan})`);
      return true;
    } else {
      console.error(`❌ [${toolName}] Failed to record download`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error recording download:', error.message);
    return false;
  }
}