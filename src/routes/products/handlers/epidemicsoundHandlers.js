/**
 * Epidemic Sound Handlers - OPTIMIZED VERSION
 * Uses decryptUserCookiesNoSessionCheck for speed
 */
import axios from 'axios';
import { decryptUserCookies, decryptUserCookiesNoSessionCheck } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
import epidemicsoundConfig from '../../../../products/epidemicsound.js';

function getCurrentRotationIndex(totalAccounts) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const totalMinutes = currentHour * 60 + currentMinute;
  const intervalIndex = Math.floor(totalMinutes / 10);
  return intervalIndex % totalAccounts;
}

/**
 * ✅ OPTIMIZED: Main Axios proxy
 */
export async function proxyEpidemicsoundWithAxios(req, res) {
  try {
    console.log('🎵 [AXIOS] Epidemic Sound request:', req.method, req.originalUrl);

    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;

    if (!accountsArray || accountsArray.length === 0) {
      return res.status(500).json({ error: 'No accounts available' });
    }

    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];

    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }

    const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');

    let cleanPath = req.originalUrl.replace('/epidemicsound', '');

    if (!cleanPath || cleanPath === '/' || cleanPath === '') {
      cleanPath = '/music/featured/?override_referrer=';
    }

    const targetUrl = `https://www.epidemicsound.com${cleanPath}`;

    console.log('🎯 Target URL:', targetUrl);

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...epidemicsoundConfig.customHeaders,
        'referer': 'https://www.epidemicsound.com/',
        'user-agent': USER_AGENT,
        'Cookie': cookieString
      },
      data: req.body,
      validateStatus: () => true,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 15000
    });

    console.log(`✅ Response: ${response.status}`);

    const contentType = response.headers['content-type'] || 'application/octet-stream';

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', contentType);

    // ✅ SIMPLIFIED: Minimal HTML processing
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');

      const currentHost = `${req.protocol}://${req.get('host')}`;

      // Just rewrite external domains
      html = html.replace(/https:\/\/static\.epidemicsound\.com/g, `${currentHost}/epidemicsound/static`);
      html = html.replace(/https:\/\/cdn\.epidemicsound\.com/g, `${currentHost}/epidemicsound/cdn`);
      html = html.replace(/https:\/\/images\.epidemicsound\.com/g, `${currentHost}/epidemicsound/images`);
      html = html.replace(/https:\/\/media\.epidemicsound\.com/g, `${currentHost}/epidemicsound/media`);

      return res.status(response.status).send(html);
    }

    return res.status(response.status).send(response.data);

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ error: 'Proxy error' });
  }
}

// ✅ OPTIMIZED: Static assets (no session check)
export async function proxyEpidemicsoundStatic(req, res) {
  try {
    const assetPath = req.path.replace('/static', '');
    const targetUrl = `https://static.epidemicsound.com${assetPath}`;

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/'
      },
      validateStatus: () => true,
      timeout: 10000
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Static error:', error.message);
    return res.status(500).send('');
  }
}

export async function proxyEpidemicsoundCDN(req, res) {
  try {
    const assetPath = req.path.replace('/cdn', '');
    const targetUrl = `https://cdn.epidemicsound.com${assetPath}`;

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/'
      },
      validateStatus: () => true
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ CDN error:', error.message);
    return res.status(500).send('');
  }
}

export async function proxyEpidemicsoundAssets(req, res) {
  try {
    const assetPath = req.path.replace('/assets', '');
    const targetUrl = `https://assets.epidemicsound.com${assetPath}`;

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/'
      },
      validateStatus: () => true
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Assets error:', error.message);
    return res.status(500).send('');
  }
}

// ✅ OPTIMIZED: Images (no session check)
export async function proxyEpidemicsoundImages(req, res) {
  try {
    const userData = await decryptUserCookiesNoSessionCheck(req);

    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;

    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];

    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }

    const cookieString = cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const imagePath = req.path.replace('/images', '');
    const targetUrl = `https://images.epidemicsound.com${imagePath}`;

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.epidemicsound.com/',
        'Accept': 'image/*',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 10000
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Image error:', error.message);
    return res.status(500).send('');
  }
}

// ✅ OPTIMIZED: Media (no session check)
export async function proxyEpidemicsoundMedia(req, res) {
  try {
    const userData = await decryptUserCookiesNoSessionCheck(req);

    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;

    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];

    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }

    const cookieString = cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const mediaPath = req.path.replace('/media', '');
    const targetUrl = `https://media.epidemicsound.com${mediaPath}`;

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.epidemicsound.com/',
        'Accept': 'audio/*',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 30000
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Media error:', error.message);
    return res.status(500).send('');
  }
}