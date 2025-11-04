/**
 * Cookie Service
 * Manages premium cookies and user session cookies
 */
import axios from 'axios';
import { decryptCookieValue } from './encryptionService.js';
import { getDataFromApiWithoutVerify } from './apiService.js';
import { getCache, setCache } from './cacheService.js';
import { parseCookieString } from '../utils/helpers.js';
import { COOKIE_CACHE_TTL_SECONDS, COOKIE_EXPIRATION_HOURS } from '../utils/constants.js';
import { isExpired } from '../utils/helpers.js';

/**
 * Get premium cookies for a product (with caching)
 */
export async function getPremiumCookies(prefix, index = 0, includeProxy = false) {
  // Check cache first
  const cacheKey = `${prefix}_${index}`;
  const cached = getCache('premiumCookies', cacheKey);
  
  if (cached) {
    return {
      cookies: cached.cookies,
      proxy: includeProxy ? cached.proxy : null
    };
  }

  // Fetch from API
  try {
    const data = await getDataFromApiWithoutVerify(prefix);

    const cookiesStr = data.access_configuration_preferences[0].accounts[index];
    
    // Parse cookies
    const cookies = parseCookieString(cookiesStr);

    // Get proxy (if available)
    let proxy = null;
    try {
      proxy = data.access_configuration_preferences[1].proxies[0];
    } catch {
      // No proxy available
    }

    // Cache the result
    setCache('premiumCookies', cacheKey, { cookies, proxy }, COOKIE_CACHE_TTL_SECONDS);

    return {
      cookies,
      proxy: includeProxy ? proxy : null
    };
  } catch (error) {
    console.error('❌ Error getting premium cookies:', error.message);
    throw error;
  }
}

/**
 * Decrypt all user cookies from request
 */
export async function decryptUserCookies(req) {
  const rawAuthToken = req.cookies.auth_token;
  const rawPrefix = req.cookies.prefix;
  const product = req.cookies.product;
  const site = req.cookies.site;
  const userEmail = req.cookies.user_email;
  const timeStampRaw = req.cookies.ttl;

  // Validate required cookies
  if (!rawAuthToken || !rawPrefix || !product || !site || !timeStampRaw) {
    return { redirect: '/expired' };
  }

  // Decrypt and validate timestamp
  try {
    const timeStampDec = decryptCookieValue(timeStampRaw);
    const timeStampInt = parseInt(timeStampDec, 10);

    if (isExpired(timeStampInt, COOKIE_EXPIRATION_HOURS)) {
      // Session expired
      return { redirect: '/expired' };
    }
  } catch (error) {
    console.error('❌ Error decrypting timestamp:', error.message);
    return { redirect: '/expired' };
  }

  // Decrypt all cookies first
  try {
    const authToken = decryptCookieValue(rawAuthToken);
    const prefix = decryptCookieValue(rawPrefix);
    const productDec = decryptCookieValue(product);
    const siteDec = decryptCookieValue(site);
    const userEmailDec = userEmail ? decryptCookieValue(userEmail) : null;

    // ✅ CHECK DASHBOARD SESSION - Re-enabled
    if (userEmailDec && authToken) {
      const isValid = await checkDashboardSession(userEmailDec, authToken);
      if (!isValid) {
        console.log('⚠️ Session invalidated by dashboard:', userEmailDec);
        return { redirect: '/expired' };
      }
    }

    const decryptedCookies = {
      auth_token: authToken,
      prefix: prefix,
      product: productDec,
      site: siteDec,
      user_email: userEmailDec
    };

    // Cache the result (30 seconds max)
    if (COOKIE_CACHE_TTL_SECONDS > 0) {
      setCache('decryptedSessions', JSON.stringify([rawAuthToken, rawPrefix, product, site, timeStampRaw]), decryptedCookies, Math.min(COOKIE_CACHE_TTL_SECONDS, 30));
    }

    return decryptedCookies;
  } catch (error) {
    console.error('❌ Error decrypting user cookies:', error.message);
    return { redirect: '/expired' };
  }
}

// ✅ Check dashboard session using oneclick session-check endpoint
async function checkDashboardSession(email, authToken) {
  try {
    console.log('🔍 Checking dashboard session for:', email);
    
    const url = `${process.env.DASHBOARD_URL}/api/oneclick/session-check`;
    console.log('📞 Calling:', url);
    
    const response = await axios.post(url, {
      email: email  // ✅ CHANGED: Send email in body
    }, {
      headers: {
        'Content-Type': 'application/json'
        // ✅ REMOVED: Authorization header
      },
      timeout: 3000,
      validateStatus: () => true
    });

    console.log('📡 Response:', {
      status: response.status,
      data: response.data
    });

    // Check if response is valid JSON
    if (typeof response.data !== 'object') {
      console.error('❌ Invalid response format (not JSON)');
      return false;
    }

    const isValid = response.data.valid === true && 
                   response.data.email === email;

    console.log(isValid ? '✅ Session valid' : '❌ Session invalid');
    
    return isValid;

  } catch (error) {
    console.error('⚠️ Dashboard validation failed:', error.message);
    return false;
  }
}
 