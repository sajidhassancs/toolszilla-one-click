/**
 * Pikbest Specific Handlers
 */
import pikbestConfig from '../../../../products/pikbest.js';
import axios from 'axios';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';

/**
 * Main Pikbest proxy handler using Axios
 */
export async function proxyPikbestWithAxios(req, res) {
  try {
    console.log('🎨 Pikbest request:', req.method, req.originalUrl);

    // Get user cookies
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    // Clean the path
    const productPrefix = '/pikbest';
    let cleanPath = req.originalUrl;
    
    if (cleanPath.startsWith(productPrefix)) {
      cleanPath = cleanPath.substring(productPrefix.length);
    }
    
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
    
    // Build target URL
    const targetUrl = `https://${pikbestConfig.domain}${cleanPath}`;
    console.log('🎯 Target URL:', targetUrl);
    
    // Make request
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...pikbestConfig.customHeaders,
        'referer': `https://${pikbestConfig.domain}/`,
        'Cookie': cookieString
      },
      data: req.body,
      validateStatus: () => true,
      responseType: 'arraybuffer'
    });
    
    console.log(`✅ Response: ${response.status}`);
    
    res.set('Access-Control-Allow-Origin', '*');
    
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const currentHost = `${req.protocol}://${req.get('host')}`;
    
    // For HTML, rewrite URLs
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');
      
      console.log('🔧 Rewriting URLs in HTML...');
      
      // Replace CDN domains
      html = html.replace(/https:\/\/img\.pikbest\.com/g, `${currentHost}/pikbest/img`);
      html = html.replace(/https:\/\/img01\.pikbest\.com/g, `${currentHost}/pikbest/img01`);
      html = html.replace(/https:\/\/img02\.pikbest\.com/g, `${currentHost}/pikbest/img02`);
      html = html.replace(/https:\/\/img03\.pikbest\.com/g, `${currentHost}/pikbest/img03`);
      html = html.replace(/https:\/\/static\.pikbest\.com/g, `${currentHost}/pikbest/static`);
      
      // Protocol-relative URLs
      html = html.replace(/\/\/img\.pikbest\.com/g, `${currentHost}/pikbest/img`);
      html = html.replace(/\/\/img01\.pikbest\.com/g, `${currentHost}/pikbest/img01`);
      html = html.replace(/\/\/img02\.pikbest\.com/g, `${currentHost}/pikbest/img02`);
      html = html.replace(/\/\/img03\.pikbest\.com/g, `${currentHost}/pikbest/img03`);
      html = html.replace(/\/\/static\.pikbest\.com/g, `${currentHost}/pikbest/static`);
      
      // Add base tag
      if (html.includes('<head>')) {
        const baseTag = `<base href="${currentHost}/pikbest/">`;
        html = html.replace('<head>', `<head>${baseTag}`);
        console.log('   ✅ Injected base tag');
      }
      
      // Fix absolute paths
      html = html.replace(/href="\//g, 'href="/pikbest/');
      html = html.replace(/src="\//g, 'src="/pikbest/');
      html = html.replace(/srcset="\//g, 'srcset="/pikbest/');
      html = html.replace(/url\(\//g, 'url(/pikbest/');
      
      // Fix double slashes
      html = html.replace(/\/pikbest\/pikbest\//g, '/pikbest/');
      
      console.log('   ✅ URL rewriting complete');
      
      return res.status(response.status).type('text/html').send(html);
    }
    
    // For JavaScript
    if (contentType.includes('javascript')) {
      let js = response.data.toString('utf-8');
      
      js = js.replace(/https:\/\/img\.pikbest\.com/g, `${currentHost}/pikbest/img`);
      js = js.replace(/https:\/\/static\.pikbest\.com/g, `${currentHost}/pikbest/static`);
      js = js.replace(/"\/api\//g, '"/pikbest/api/');
      
      return res.status(response.status).type(contentType).send(js);
    }
    
    // For CSS
    if (contentType.includes('css')) {
      let css = response.data.toString('utf-8');
      
      css = css.replace(/url\(\//g, 'url(/pikbest/');
      css = css.replace(/https:\/\/img\.pikbest\.com/g, `${currentHost}/pikbest/img`);
      css = css.replace(/https:\/\/static\.pikbest\.com/g, `${currentHost}/pikbest/static`);
      
      return res.status(response.status).type(contentType).send(css);
    }
    
    // For other content
    return res.status(response.status).type(contentType).send(response.data);
    
  } catch (error) {
    console.error('❌ Error proxying Pikbest:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Proxy Pikbest API calls
 */
export async function proxyPikbestAPI(req, res) {
  try {
    const userData = await decryptUserCookies(req);
    
    if (userData.redirect) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const apiPath = req.originalUrl.replace('/pikbest/api', '').replace('/pikbest', '');
    const targetUrl = `https://pikbest.com${apiPath}`;
    
    console.log('🔌 Proxying Pikbest API:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || 'application/json',
        'Referer': 'https://pikbest.com/',
        'Cookie': cookieString,
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      data: req.body,
      validateStatus: () => true,
      timeout: 10000
    });
    
    console.log('✅ API response status:', response.status);
    
    res.set('Access-Control-Allow-Origin', '*');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Pikbest API:', error.message);
    return res.status(500).json({ error: 'API proxy error' });
  }
}

/**
 * Proxy Pikbest images and static assets
 */
export async function proxyPikbestImages(req, res, domain) {
  try {
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).send('Unauthorized');
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    // Get asset path
    let assetPath = req.originalUrl
      .replace('/pikbest/img', '')
      .replace('/pikbest/img01', '')
      .replace('/pikbest/img02', '')
      .replace('/pikbest/img03', '')
      .replace('/pikbest/static', '')
      .replace('/pikbest/css', '')
      .replace('/pikbest/js', '')
      .replace('/pikbest', '');
    
    const targetUrl = `https://${domain}${assetPath}`;
    
    console.log('🎨 Proxying asset:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://pikbest.com/',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 15000
    });
    
    console.log('✅ Asset response:', response.status);
    
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying asset:', error.message);
    return res.status(500).send('Asset loading failed');
  }
}