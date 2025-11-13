/**
 * Iconscout Product Configuration
 */
export default {
  // Basic Info
  name: 'iconscout',
  displayName: 'Iconscout',
  
  // Target Website
  domain: 'iconscout.com',
  
  // Redirect path after login
  redirectPath: '/',
  
  // Banned paths (product-specific, env vars will also apply)
  bannedPaths: [],  // ✅ Empty - we're using BANNED_URL_PATHS from .env
  
  // Proxy port (if running standalone)
  proxyPort: 8224,
  
  // Use external proxy server
  useExternalProxy: false,
  
  // Domain replacement rules [find, replace]
  replaceRules: [
    ['cdn.iconscout.com', 'localhost:8224/iconscout/image/cdn'],      // ✅ Changed to localhost
    ['cdn3d.iconscout.com', 'localhost:8224/iconscout/image/cdn3d'],  // ✅ Changed to localhost
    ['cdna.iconscout.com', 'localhost:8224/iconscout/image/cdna'],    // ✅ Changed to localhost
    ['assets.iconscout.com', 'localhost:8224/iconscout/image/assets'], // ✅ Changed to localhost
    ['api.iconscout.com', 'localhost:8224/iconscout/api-domain']       // ✅ Changed to localhost
  ],
  
  // Custom headers for requests
  customHeaders: {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'max-age=0',
    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'accept-encoding': 'gzip, deflate, br'
  },
  
  // Custom cookies (if any static cookies needed)
  customCookies: {}
};