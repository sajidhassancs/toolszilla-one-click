/**
 * Download Controller
 * Handles download tracking and limits (matches Python flow)
 */
import { canUserDownload, recordDownload } from '../services/limitService.js';
import { DOWNLOAD_LIMITS } from '../utils/constants.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Show limit reached page with countdown timer
 */
export async function showLimitReachedPage(req, res, productName, plan = 'default') {
  try {
    const viewsPath = path.join(process.cwd(), 'src', 'views', 'limit_reached.html');

    if (!fs.existsSync(viewsPath)) {
      console.error('❌ limit_reached.html not found at:', viewsPath);
      return res.status(429).send('Daily download limit reached. Please try again tomorrow.');
    }

    // Read the HTML template
    let html = fs.readFileSync(viewsPath, 'utf-8');

    // Get the limit for this plan
    const dailyLimit = DOWNLOAD_LIMITS[plan] || DOWNLOAD_LIMITS.default;

    // Replace template variables
    html = html.replace(/\{\{daily_limit\}\}/g, dailyLimit);
    html = html.replace(/\{\{APP_NAME\}\}/g, productName);
    html = html.replace(/<title>Daily Usage Limit Reached - .*?<\/title>/g,
      `<title>Daily Usage Limit Reached - ${productName}</title>`);

    // Send the processed HTML
    return res.status(429).send(html);

  } catch (error) {
    console.error('❌ Error showing limit reached page:', error.message);
    return res.status(429).send('Daily download limit reached. Please try again tomorrow.');
  }
}

/**
 * Check if user can download (matches Python's check_or_add_download with add_download=False)
 */
export async function checkDownloadPermission(req, toolName, userEmail, plan = 'default') {
  try {
    const result = await canUserDownload(req, toolName, userEmail, plan);

    console.log(`📊 [${toolName}] ${userEmail}: ${result.count}/${result.limit} (allowed: ${result.allowed})`);

    return {
      allowed: result.allowed,
      count: result.count,
      limit: result.limit
    };
  } catch (error) {
    console.error('❌ Error checking download permission:', error.message);
    // ✅ Fail-open: Allow download on error (same as Python)
    const limit = DOWNLOAD_LIMITS[plan] || DOWNLOAD_LIMITS.default;
    return {
      allowed: true,
      count: 0,
      limit: limit,
      error: error.message
    };
  }
}

/**
 * Record download action (matches Python's check_or_add_download with add_download=True)
 */
export async function recordDownloadAction(req, toolName, userEmail, plan = 'default', info = null) {
  try {
    const success = await recordDownload(req, toolName, userEmail, plan, info);

    if (success) {
      console.log(`✅ [${toolName}] Download recorded for ${userEmail}`);
    } else {
      console.warn(`⚠️  [${toolName}] Failed to record download for ${userEmail}`);
    }

    return success;
  } catch (error) {
    console.error('❌ Error recording download:', error.message);
    return false;
  }
}