/**
 * TurnDetect Specific Handlers
 * Simple axios-based proxy (NO Puppeteer needed!)
 */
import axios from 'axios';
import { decryptUserCookies, decryptUserCookiesNoSessionCheck } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
import turndetectConfig from '../../../../products/turndetect.js';

/**
 * Get user cookie string
 */
export async function getUserCookieString(req) {
  try {
    const userData = await decryptUserCookiesNoSessionCheck(req);

    if (userData.redirect) {
      return null;
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];

    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }

    if (!Array.isArray(cookiesArray)) {
      return null;
    }

    // ✅ DEBUG: Log the cookies we're using
    console.log('🍪 [DEBUG] Cookies for TurnDetect:');
    cookiesArray.forEach(cookie => {
      console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
    });

    return cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  } catch (error) {
    console.error('❌ Cookie error:', error.message);
    return null;
  }
}
export async function proxyTurnDetectWithAxios(req, res) {
  try {
    console.log('\n========== TURNDETECT REQUEST ==========');
    console.log('🔍 [TURNDETECT] Proxy request:', req.method, req.originalUrl);

    // Clean path first
    let cleanPath = req.originalUrl.replace('/turndetect', '');
    if (!cleanPath || cleanPath === '') {
      cleanPath = '/dashboard';
    }

    // ✅ For public assets, don't require cookies
    const publicPaths = ['/manifest.json', '/logo', '/favicon', '/static/', '.png', '.jpg', '.css', '.js', '.map'];
    const isPublicAsset = publicPaths.some(p => cleanPath.includes(p));

    // Get cookies
    let cookieString = '';
    if (!isPublicAsset) {
      cookieString = await getUserCookieString(req);
      if (!cookieString) {
        console.log('   ❌ No cookies - redirecting');
        return res.redirect('/setup-session');
      }
      console.log('   ✅ Got cookies');
    } else {
      console.log('   ⚠️ Public asset');
      try {
        cookieString = await getUserCookieString(req);
      } catch (e) {
        // Ignore
      }
    }

    const targetUrl = `https://turndetect.com${cleanPath}`;
    console.log('   🎯 Target:', targetUrl);

    // Make request
    const headers = {
      'accept': '*/*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'referer': 'https://turndetect.com/',
      'user-agent': USER_AGENT
    };

    if (cookieString) {
      headers['Cookie'] = cookieString;
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: headers,
      data: req.body,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 15000
    });

    console.log('   ✅', response.status, response.headers['content-type']);

    const contentType = response.headers['content-type'] || 'application/octet-stream';

    // NO cache
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Access-Control-Allow-Origin', '*');

    // ✅ ONLY rewrite HTML tags, be VERY conservative
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');

      // ONLY rewrite opening tags for href and src
      // Use negative lookahead to avoid rewriting inside <script> tags
      html = html.replace(/<link([^>]*?)href="\//g, '<link$1href="/turndetect/');
      html = html.replace(/<a([^>]*?)href="\//g, '<a$1href="/turndetect/');
      html = html.replace(/<img([^>]*?)src="\//g, '<img$1src="/turndetect/');
      html = html.replace(/<script([^>]*?)src="\//g, '<script$1src="/turndetect/');

      // Fix doubles
      html = html.replace(/\/turndetect\/turndetect\//g, '/turndetect/');

      res.set('Content-Type', 'text/html');
      return res.status(response.status).send(html);
    }

    // Everything else - pass through UNCHANGED
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}