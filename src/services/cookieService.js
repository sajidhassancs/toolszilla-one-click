/**
 * Cookie Service - OPTIMIZED VERSION
 * Manages premium cookies and user session cookies with aggressive caching
 */
import axios from 'axios';
import { decryptCookieValue } from './encryptionService.js';
import { getDataFromApiWithoutVerify } from './apiService.js';
import { getCache, setCache } from './cacheService.js';
import {
  getCachedSession,
  setCachedSession,
  getCachedDashboardValidation,
  setCachedDashboardValidation
} from './sessionCache.js';
import { parseCookieString } from '../utils/helpers.js';
import { COOKIE_CACHE_TTL_SECONDS, COOKIE_EXPIRATION_HOURS } from '../utils/constants.js';
import { isExpired } from '../utils/helpers.js';

/**
 * Get premium cookies for a product (with caching)
 */
export async function getPremiumCookies(prefix, index = 0, includeProxy = false) {
  const cacheKey = `${prefix}_${index}`;
  const cached = getCache('premiumCookies', cacheKey);

  if (cached) {
    return {
      cookies: cached.cookies,
      proxy: includeProxy ? cached.proxy : null
    };
  }

  try {
    const data = await getDataFromApiWithoutVerify(prefix);
    const cookiesStr = data.access_configuration_preferences[0].accounts[index];
    const cookies = parseCookieString(cookiesStr);

    let proxy = null;
    try {
      proxy = data.access_configuration_preferences[1].proxies[0];
    } catch {
      // No proxy available
    }

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
 * ✅ OPTIMIZED: Decrypt user cookies WITH session cache
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

  // ✅ CREATE FINGERPRINT for caching
  const cookieFingerprint = `${rawAuthToken}_${rawPrefix}_${product}_${timeStampRaw}`;

  // ✅ CHECK SESSION CACHE FIRST (saves ALL the work below)
  const cached = getCachedSession(cookieFingerprint);
  if (cached) {
    return cached;
  }

  // Decrypt and validate timestamp ONCE
  try {
    const timeStampDec = decryptCookieValue(timeStampRaw);
    const timeStampInt = parseInt(timeStampDec, 10);

    if (isExpired(timeStampInt, COOKIE_EXPIRATION_HOURS)) {
      return { redirect: '/expired' };
    }
  } catch (error) {
    console.error('❌ Error decrypting timestamp:', error.message);
    return { redirect: '/expired' };
  }

  // Decrypt all cookies ONCE
  try {
    const authToken = decryptCookieValue(rawAuthToken);
    const prefix = decryptCookieValue(rawPrefix);
    const productDec = decryptCookieValue(product);
    const siteDec = decryptCookieValue(site);
    const userEmailDec = userEmail ? decryptCookieValue(userEmail) : null;

    // ✅ CHECK DASHBOARD SESSION (with its own cache layer)
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

    // ✅ CACHE THE SESSION for 30 seconds
    setCachedSession(cookieFingerprint, decryptedCookies);

    return decryptedCookies;
  } catch (error) {
    console.error('❌ Error decrypting user cookies:', error.message);
    return { redirect: '/expired' };
  }
}

/**
 * ✅ OPTIMIZED: Decrypt user cookies WITHOUT dashboard session check
 */
export async function decryptUserCookiesNoSessionCheck(req) {
  const rawAuthToken = req.cookies.auth_token;
  const rawPrefix = req.cookies.prefix;
  const product = req.cookies.product;
  const site = req.cookies.site;
  const userEmail = req.cookies.user_email;
  const timeStampRaw = req.cookies.ttl;

  if (!rawAuthToken || !rawPrefix || !product || !site || !timeStampRaw) {
    return { redirect: '/expired' };
  }

  // ✅ CREATE FINGERPRINT for caching
  const cookieFingerprint = `no_check_${rawAuthToken}_${rawPrefix}_${product}_${timeStampRaw}`;

  // ✅ CHECK CACHE FIRST
  const cached = getCachedSession(cookieFingerprint);
  if (cached) {
    return cached;
  }

  try {
    const timeStampDec = decryptCookieValue(timeStampRaw);
    const timeStampInt = parseInt(timeStampDec, 10);

    if (isExpired(timeStampInt, COOKIE_EXPIRATION_HOURS)) {
      return { redirect: '/expired' };
    }
  } catch (error) {
    console.error('❌ Error decrypting timestamp:', error.message);
    return { redirect: '/expired' };
  }

  try {
    const authToken = decryptCookieValue(rawAuthToken);
    const prefix = decryptCookieValue(rawPrefix);
    const productDec = decryptCookieValue(product);
    const siteDec = decryptCookieValue(site);
    const userEmailDec = userEmail ? decryptCookieValue(userEmail) : null;

    const result = {
      auth_token: authToken,
      prefix: prefix,
      product: productDec,
      site: siteDec,
      user_email: userEmailDec
    };

    // ✅ CACHE IT for 30 seconds
    setCachedSession(cookieFingerprint, result);

    return result;
  } catch (error) {
    console.error('❌ Error decrypting user cookies:', error.message);
    return { redirect: '/expired' };
  }
}

/**
 * ✅ OPTIMIZED: Dashboard session check with caching
 */
async function checkDashboardSession(email, authToken) {
  // ✅ CHECK CACHE FIRST
  const cachedValidation = getCachedDashboardValidation(email, authToken);
  if (cachedValidation !== null) {
    return cachedValidation;
  }

  try {
    const url = `${process.env.API_URL}/oneclick/session-check`;

    const response = await axios.post(url, {
      email: email
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000, // ✅ Reduced from 15000 to 5000
      validateStatus: () => true
    });

    if (typeof response.data !== 'object') {
      // ✅ CACHE NEGATIVE RESULT
      setCachedDashboardValidation(email, authToken, false);
      return false;
    }

    const isValid = response.data.valid === true && response.data.email === email;

    // ✅ CACHE THE RESULT for 15 seconds
    setCachedDashboardValidation(email, authToken, isValid);

    console.log(isValid ? '✅ Session valid' : '❌ Session invalid');
    return isValid;

  } catch (error) {
    console.error('⚠️ Dashboard validation failed:', error.message);

    // ✅ CACHE as VALID (fail-open for resilience)
    setCachedDashboardValidation(email, authToken, true);
    return true;
  }
}