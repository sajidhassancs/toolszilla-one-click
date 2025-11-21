/**
 * API Service
 * Handles all external API calls (Supabase, Stats API)
 */
import axios from 'axios';
import { API_URL, API_KEY, LIMIT_API_URL, LIMIT_API_KEY } from '../utils/constants.js';

/**
 * Get data from main API with verification
 */
export async function getDataFromApi(authToken, prefix) {
  try {
    console.log('📡 Calling API with verification:');
    console.log('   URL:', `${API_URL}/oneclick/access_and_verify/`);
    console.log('   Prefix:', prefix);

    const response = await axios.post(
      `${API_URL}/oneclick/access_and_verify/`,
      null,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { prefix },
        timeout: 10000 // ✅ Add timeout
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Error getting data from API:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Get data from API without verification
 */
export async function getDataFromApiWithoutVerify(prefix) {
  try {
    console.log('📡 Calling API without verification:');
    console.log('   URL:', `${API_URL}/oneclick/access_without_verify/${prefix}`);
    console.log('   API_KEY:', API_KEY ? 'Set' : 'Missing');

    const response = await axios.get(
      `${API_URL}/oneclick/access_without_verify/${prefix}`,
      {
        headers: { Authorization: API_KEY },
        timeout: 10000 // ✅ Add timeout
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Error getting data from API without verify:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Check download limit from Stats API (matches Python check_or_add_download)
 */
export async function checkDownloadLimit(toolName, userEmail) {
  try {
    console.log(`🔍 [LIMIT CHECK] ${toolName} - ${userEmail}`);
    console.log(`   API: ${LIMIT_API_URL}/api/stats/today`);

    const response = await axios.get(
      `${LIMIT_API_URL}/api/stats/today`,
      {
        headers: {
          'X-API-Key': LIMIT_API_KEY,
          'Content-Type': 'application/json'
        },
        params: {
          tool_name: toolName,
          email: userEmail
        },
        timeout: 5000,
        validateStatus: (status) => status < 500 // ✅ Accept 4xx as valid
      }
    );

    // ✅ Handle different response structures
    const data = response.data;
    let downloadCount = 0;

    // Try different response formats
    if (data.by_tool && Array.isArray(data.by_tool) && data.by_tool.length > 0) {
      downloadCount = parseInt(data.by_tool[0].count || 0, 10);
    } else if (data.count !== undefined) {
      downloadCount = parseInt(data.count || 0, 10);
    } else if (data.downloads !== undefined) {
      downloadCount = parseInt(data.downloads || 0, 10);
    }

    console.log(`   ✅ Count: ${downloadCount}`);

    return {
      success: true,
      count: downloadCount
    };
  } catch (error) {
    console.error('❌ [LIMIT CHECK] Error:', error.message);

    // ✅ Log more details for debugging
    if (error.code === 'ECONNREFUSED') {
      console.error('   ⚠️  Stats API connection refused - is it running?');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   ⚠️  Stats API timeout - network issue?');
    }

    // ✅ CRITICAL: Fail-open (allow downloads on error)
    console.log('   ⚠️  Failing open - allowing download');
    return {
      success: true,
      count: 0,
      error: error.message
    };
  }
}

/**
 * Add download record to Stats API (matches Python add_download)
 */
export async function addDownloadRecord(toolName, userEmail, website, userIp, info = null) {
  try {
    console.log(`📝 [RECORD] ${toolName} - ${userEmail}`);
    console.log(`   API: ${LIMIT_API_URL}/api/stats/today`);

    const payload = {
      tool_name: toolName,
      email: userEmail,
      website: website,
      user_ip: userIp
    };

    // ✅ Add info - can be object or string
    if (info) {
      if (typeof info === 'string') {
        payload.info = info;
      } else if (typeof info === 'object') {
        payload.info = JSON.stringify(info);
      }
    }

    console.log('   Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${LIMIT_API_URL}/api/stats/today`,
      payload,
      {
        headers: {
          'X-API-Key': LIMIT_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 5000,
        validateStatus: (status) => status < 500 // ✅ Accept 4xx as valid
      }
    );

    console.log('   ✅ Recorded:', response.status);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('❌ [RECORD] Error:', error.message);

    // ✅ Log more details for debugging
    if (error.code === 'ECONNREFUSED') {
      console.error('   ⚠️  Stats API connection refused - is it running?');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   ⚠️  Stats API timeout - network issue?');
    }

    // ✅ CRITICAL: Still return success (don't block downloads if recording fails)
    console.log('   ⚠️  Failed to record, but continuing');
    return {
      success: true, // ✅ Don't block downloads
      error: error.message
    };
  }
}

/**
 * Get download stats for a user (optional - for analytics)
 */
export async function getUserDownloadStats(toolName, userEmail, startDate = null, endDate = null) {
  try {
    console.log(`📊 [STATS] Getting stats for ${toolName} - ${userEmail}`);

    const params = {
      tool_name: toolName,
      email: userEmail
    };

    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get(
      `${LIMIT_API_URL}/api/stats/user`,
      {
        headers: {
          'X-API-Key': LIMIT_API_KEY,
          'Content-Type': 'application/json'
        },
        params: params,
        timeout: 5000
      }
    );

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('❌ [STATS] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Reset user download count (admin only - optional)
 */
export async function resetUserDownloads(toolName, userEmail) {
  try {
    console.log(`🔄 [RESET] Resetting downloads for ${toolName} - ${userEmail}`);

    const response = await axios.delete(
      `${LIMIT_API_URL}/api/stats/today`,
      {
        headers: {
          'X-API-Key': LIMIT_API_KEY,
          'Content-Type': 'application/json'
        },
        params: {
          tool_name: toolName,
          email: userEmail
        },
        timeout: 5000
      }
    );

    console.log('   ✅ Reset successful');

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('❌ [RESET] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Health check for Stats API (optional - for monitoring)
 */
export async function checkStatsApiHealth() {
  try {
    const response = await axios.get(
      `${LIMIT_API_URL}/health`,
      {
        headers: { 'X-API-Key': LIMIT_API_KEY },
        timeout: 3000
      }
    );

    return {
      success: true,
      status: response.data
    };
  } catch (error) {
    console.error('❌ Stats API health check failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}