/**
 * Download Controller
 * Handles download tracking and limits
 */
import { canUserDownload, recordDownload } from '../services/limitService.js';
import { DOWNLOAD_LIMITS } from '../utils/constants.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Show limit reached page
 */
export async function showLimitReachedPage(req, res, productName, plan = 'default') {
  try {
    const viewsPath = path.join(process.cwd(), 'src', 'views', 'limit_reached.html');
    
    if (!fs.existsSync(viewsPath)) {
      console.error('❌ limit_reached.html not found at:', viewsPath);
      return res.status(429).send('Daily download limit reached. Please try again tomorrow.');
    }
    
    return res.sendFile(viewsPath);
  } catch (error) {
    console.error('❌ Error showing limit reached page:', error.message);
    return res.status(429).send('Daily download limit reached. Please try again tomorrow.');
  }
}

/**
 * Check if user can download
 */
export async function checkDownloadPermission(req, toolName, userEmail, plan = 'default') {
  try {
    const result = await canUserDownload(req, toolName, userEmail, plan);

    return {
      allowed: result.allowed,
      count: result.count,
      limit: result.limit
    };
  } catch (error) {
    console.error('❌ Error checking download permission:', error.message);
    return {
      allowed: false,
      count: 0,
      limit: DOWNLOAD_LIMITS[plan] || DOWNLOAD_LIMITS.default,
      error: error.message
    };
  }
}

/**
 * Record download action
 */
export async function recordDownloadAction(req, toolName, userEmail, info = null) {
  try {
    const success = await recordDownload(req, toolName, userEmail, info);

    if (success) {
      console.log(`✅ Download recorded: ${toolName} - ${userEmail}`);
    } else {
      console.warn(`⚠️  Failed to record download: ${toolName} - ${userEmail}`);
    }

    return success;
  } catch (error) {
    console.error('❌ Error recording download:', error.message);
    return false;
  }
}