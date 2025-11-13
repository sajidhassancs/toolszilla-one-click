/**
 * Iconscout Axios-based Proxy (Based on standalone working version)
 */
import axios from 'axios';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
import iconscoutConfig from '../../../../products/iconscout.js';

export async function proxyIconscoutWithAxios(req, res) {
  try {
    console.log('🎨 Iconscout request:', req.method, req.originalUrl);

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
    
    // Convert cookies array to cookie string
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    // Clean the path
    const productPrefix = '/iconscout';
    let cleanPath = req.originalUrl;
    
    if (cleanPath.startsWith(productPrefix)) {
      cleanPath = cleanPath.substring(productPrefix.length);
    }
    
    if (!cleanPath || cleanPath === '') {
      cleanPath = '/';
    }
    
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
    
    const targetUrl = `https://${iconscoutConfig.domain}${cleanPath}`;
    console.log('🔍 cleanPath:', cleanPath);
    console.log('🔍 targetUrl:', targetUrl);
    
    // Make request
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'cache-control': 'max-age=0',
        'referer': `https://${iconscoutConfig.domain}/`,
        'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
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
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    
    // Get current host for dynamic replacements
    const currentHost = `${req.protocol}://${req.get('host')}`;
    
  // For HTML, rewrite URLs
if (contentType.includes('text/html')) {
  let html = response.data.toString('utf-8');
  
  console.log('🔧 Rewriting HTML URLs...');
  
  // ✅ Replace CDN domains with /image prefix
  html = html.replace(/https:\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn3d`);
  html = html.replace(/https:\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/image/cdna`);
  html = html.replace(/https:\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn`);
  html = html.replace(/https:\/\/assets\.iconscout\.com/g, `${currentHost}/iconscout/image/assets`);
  
  // ✅ Protocol-relative URLs with /image prefix
  html = html.replace(/\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn3d`);
  html = html.replace(/\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/image/cdna`);
  html = html.replace(/\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn`);
  html = html.replace(/\/\/assets\.iconscout\.com/g, `${currentHost}/iconscout/image/assets`);
  
  // Fix relative paths
  html = html.replace(/href="\/(?!iconscout)/g, 'href="/iconscout/');
  html = html.replace(/src="\/(?!iconscout)/g, 'src="/iconscout/');
  
  // ✅ CRITICAL: Inject CDN URL override script with /image prefix
  const cdnOverrideScript = `
    <script>
    (function() {
      // Override URL construction for CDN images
      const originalImage = window.Image;
      window.Image = function() {
        const img = new originalImage();
        const originalSetSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
        Object.defineProperty(img, 'src', {
          set: function(value) {
            let newValue = value;
            if (typeof value === 'string') {
              newValue = value
                .replace(/https:\\/\\/cdn3d\\.iconscout\\.com/g, '${currentHost}/iconscout/image/cdn3d')
                .replace(/https:\\/\\/cdna\\.iconscout\\.com/g, '${currentHost}/iconscout/image/cdna')
                .replace(/https:\\/\\/cdn\\.iconscout\\.com/g, '${currentHost}/iconscout/image/cdn');
            }
            originalSetSrc.call(this, newValue);
          },
          get: function() {
            return this.getAttribute('src');
          }
        });
        return img;
      };
      
      // Also override setAttribute for existing images
      const originalSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        if (name === 'src' && this.tagName === 'IMG') {
          value = value
            .replace(/https:\\/\\/cdn3d\\.iconscout\\.com/g, '${currentHost}/iconscout/image/cdn3d')
            .replace(/https:\\/\\/cdna\\.iconscout\\.com/g, '${currentHost}/iconscout/image/cdna')
            .replace(/https:\\/\\/cdn\\.iconscout\\.com/g, '${currentHost}/iconscout/image/cdn');
        }
        return originalSetAttribute.call(this, name, value);
      };
    })();
    </script>
  `;
  
  // Inject script right after <head> tag
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>${cdnOverrideScript}`);
    console.log('   ✅ Injected CDN override script');
  }
  
  console.log('   ✅ HTML rewriting complete');
  
  res.set('Content-Type', 'text/html');
  return res.status(response.status).send(html);
}
    
    // ✅ For JavaScript, rewrite CDN paths with /image prefix
    if (contentType.includes('javascript') || contentType.includes('text/javascript')) {
      let js = response.data.toString('utf-8');
      
      // Replace CDN domains in JS
      js = js.replace(/https:\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/image/cdna`);
      js = js.replace(/https:\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn3d`);
      js = js.replace(/https:\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn`);
      js = js.replace(/https:\/\/api\.iconscout\.com/g, `${currentHost}/iconscout/api-domain`);
      
      return res.status(response.status).type(contentType).send(js);
    }
    
    // ✅ For CSS, rewrite URLs with /image prefix
    if (contentType.includes('css')) {
      let css = response.data.toString('utf-8');
      
      css = css.replace(/url\(\/(?!iconscout)/g, 'url(/iconscout/');
      css = css.replace(/https:\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/image/cdna`);
      css = css.replace(/https:\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn3d`);
      css = css.replace(/https:\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn`);
      
      return res.status(response.status).type(contentType).send(css);
    }
    
    // For other content, send as-is
    return res.status(response.status).type(contentType).send(response.data);
    
  } catch (error) {
    console.error('❌ Error proxying Iconscout:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ error: error.message });
  }
}