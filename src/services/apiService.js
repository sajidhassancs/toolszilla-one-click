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
        params: { prefix }
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
        headers: { Authorization: API_KEY }
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
 * Check download limit from Stats API
 */
export async function checkDownloadLimit(toolName, userEmail) {
  try {
    console.log(`🔍 Checking download limit for: ${toolName} - ${userEmail}`);
    console.log(`📡 Stats API URL: ${LIMIT_API_URL}/api/stats/today`);

    const response = await axios.get(
      `${LIMIT_API_URL}/api/stats/today`,
      {
        headers: { 'X-API-Key': LIMIT_API_KEY },
        params: {
          tool_name: toolName,
          email: userEmail
        },
        timeout: 5000 // ✅ Add timeout
      }
    );

    const data = response.data;
    const downloadCount = parseInt(data.by_tool?.[0]?.count || 0, 10);

    console.log(`✅ Current download count: ${downloadCount}`);

    return {
      success: true,
      count: downloadCount
    };
  } catch (error) {
    console.error('❌ Error checking download limit:', error.message);
    console.error('   LIMIT_API_URL:', LIMIT_API_URL);
    console.error('   LIMIT_API_KEY:', LIMIT_API_KEY ? 'Set' : 'Missing');

    // ✅ CRITICAL: Return success: true with count: 0 (fail-open)
    return {
      success: true, // ✅ Changed from false to true
      count: 0       // ✅ Allow downloads if API fails
    };
  }
}

/**
 * Add download record to Stats API
 */
export async function addDownloadRecord(toolName, userEmail, website, userIp, info = null) {
  try {
    console.log(`📝 Recording download for: ${toolName} - ${userEmail}`);
    console.log(`📡 Stats API URL: ${LIMIT_API_URL}/api/stats/today`);

    const payload = {
      tool_name: toolName,
      email: userEmail,
      website: website,
      user_ip: userIp
    };

    if (info) {
      payload.info = info;
    }

    const response = await axios.post(
      `${LIMIT_API_URL}/api/stats/today`,
      payload,
      {
        headers: { 'X-API-Key': LIMIT_API_KEY },
        timeout: 5000 // ✅ Add timeout
      }
    );

    console.log('✅ Download recorded:', response.data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('❌ Error adding download record:', error.message);
    console.error('   LIMIT_API_URL:', LIMIT_API_URL);
    console.error('   LIMIT_API_KEY:', LIMIT_API_KEY ? 'Set' : 'Missing');

    // ✅ CRITICAL: Return success: true even if recording fails (don't block downloads)
    return {
      success: true, // ✅ Changed from false to true
      error: error.message
    };
  }
}