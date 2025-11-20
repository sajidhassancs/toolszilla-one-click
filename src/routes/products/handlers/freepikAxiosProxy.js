import axios from 'axios';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';

export async function proxyFreepikWithAxios(req, res) {
    try {
        console.log('🎨 [AXIOS] Freepik request:', req.method, req.originalUrl);

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

        // Build cookie string
        const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');

        // Build target URL
        let cleanPath = req.url;
        if (!cleanPath.startsWith('/')) {
            cleanPath = '/' + cleanPath;
        }

        const targetUrl = `https://www.freepik.com${cleanPath}`;
        console.log('🎯 Target URL:', targetUrl);

        // Make request
        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'priority': 'u=1, i',
                'referer': 'https://www.freepik.com/',
                'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                'cookie': cookieString
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
            const urlFixScript = `
<script>
console.log('🔧 [FREEPIK] Proxy active');
</script>
`;
            // ✅ ONLY inject the fetch interceptor - NO URL rewriting!
            //             const urlFixScript = `
            // <script>
            // (function() {
            //   console.log('🔧 [FREEPIK] Installing fetch interceptor...');

            //   // ✅ INTERCEPT ALL FETCH CALLS
            //   const originalFetch = window.fetch;
            //   window.fetch = function(url, options) {
            //     let urlString = typeof url === 'string' ? url : url.toString();

            //     console.log('🔄 [FETCH]', urlString);

            //     // If it's an absolute freepik.com URL, make it relative
            //     if (urlString.includes('freepik.com')) {
            //       try {
            //         const urlObj = new URL(urlString);
            //         urlString = urlObj.pathname + urlObj.search + urlObj.hash;
            //         console.log('   → Converted to:', urlString);
            //       } catch (e) {
            //         // Already relative, keep as-is
            //       }
            //     }

            //     return originalFetch(urlString, options);
            //   };

            //   console.log('✅ Fetch interceptor installed');
            // })();
            // </script>
            // `;

            // ✅ Inject script
            if (html.includes('<head>')) {
                html = html.replace('<head>', `<head>${urlFixScript}`);
                console.log('   ✅ Injected fetch interceptor');
            }

            // ✅ ONLY rewrite static.cdnpk.net for assets
            html = html.replace(/https:\/\/static\.cdnpk\.net/g, `${req.protocol}://${req.get('host')}/freepik/static-cdnpk`);

            // ❌ REMOVE ALL OTHER URL REWRITES - Let fetch interceptor handle them!
            // DON'T rewrite www.freepik.com URLs in HTML anymore

            console.log('   ✅ HTML rewriting complete');

            res.set('Content-Type', 'text/html; charset=utf-8');
            return res.status(response.status).send(html);
        }

        // Handle other content types (JS, CSS, images, videos)
        res.set('Content-Type', contentType);
        return res.status(response.status).send(response.data);

    } catch (error) {
        console.error('❌ Freepik Axios proxy error:', error.message);
        return res.status(500).json({
            error: 'Freepik proxy error',
            message: error.message
        });
    }
}