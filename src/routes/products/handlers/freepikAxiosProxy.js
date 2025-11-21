import axios from 'axios';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';

export async function proxyFreepikWithAxios(req, res) {
    try {
        console.log('🎨 [AXIOS] Freepik request:', req.method, req.originalUrl);

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

        const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');

        // ✅ CRITICAL FIX: Use req.originalUrl and strip /freepik prefix
        let cleanPath = req.originalUrl;

        // Strip /freepik prefix if present
        if (cleanPath.startsWith('/freepik/')) {
            cleanPath = cleanPath.substring(8); // Remove '/freepik'
        } else if (cleanPath.startsWith('/freepik')) {
            cleanPath = cleanPath.substring(7); // Remove '/freepik' (no trailing slash)
        }

        // Ensure path starts with /
        if (!cleanPath.startsWith('/')) {
            cleanPath = '/' + cleanPath;
        }

        const targetUrl = `https://www.freepik.com${cleanPath}`;
        console.log('🎯 Target URL:', targetUrl);

        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://www.freepik.com/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': cookieString
            },
            data: req.body,
            validateStatus: () => true,
            responseType: 'arraybuffer',
            maxRedirects: 5,
            timeout: 30000
        });

        console.log(`✅ Freepik response: ${response.status}`);

        const contentType = response.headers['content-type'] || '';
        const currentHost = `${req.protocol}://${req.get('host')}`;

        // Handle HTML
        if (contentType.includes('text/html')) {
            let html = response.data.toString('utf-8');

            console.log('🔧 Rewriting Freepik HTML...');

            // ✅ Inject fetch interceptor for API calls
            const fetchInterceptor = `
<script>
(function() {
  console.log('🔧 [FREEPIK] Installing fetch interceptor...');
  
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    let urlString = typeof url === 'string' ? url : url.toString();
    
    // If it's an absolute freepik.com URL, rewrite it
    if (urlString.includes('www.freepik.com')) {
      urlString = urlString.replace('https://www.freepik.com', '${currentHost}/freepik');
      console.log('🔄 [FETCH] Rewritten:', urlString);
    }
    
    return originalFetch(urlString, options);
  };
  
  console.log('✅ Fetch interceptor installed');
})();
</script>
`;

            // Inject script
            if (html.includes('<head>')) {
                html = html.replace('<head>', `<head>${fetchInterceptor}`);
                console.log('   ✅ Injected fetch interceptor');
            }

            // ✅ Rewrite CDN URLs
            html = html.replace(/https:\/\/static\.cdnpk\.net/g, `${currentHost}/freepik/static-cdnpk`);
            html = html.replace(/https:\/\/static\.freepik\.com/g, `${currentHost}/freepik/static`);
            html = html.replace(/https:\/\/cdn\.freepik\.com/g, `${currentHost}/freepik/cdn`);
            html = html.replace(/https:\/\/cdnb\.freepik\.com/g, `${currentHost}/freepik/cdnb`);

            console.log('   ✅ HTML rewriting complete');

            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('Access-Control-Allow-Origin', '*');
            return res.status(response.status).send(html);
        }

        // Handle other content types
        if (contentType) {
            res.set('Content-Type', contentType);
        }
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(response.status).send(response.data);

    } catch (error) {
        console.error('❌ Freepik Axios proxy error:', error.message);
        return res.status(500).json({
            error: 'Freepik proxy error',
            message: error.message
        });
    }
}