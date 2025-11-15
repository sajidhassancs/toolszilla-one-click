/**
 * Envato Elements Product Configuration
 */
export default {
  // Basic Info
  name: 'envato',
  displayName: 'Envato Elements',

  // Target Website
  domain: 'elements.envato.com',

  // Redirect path after login
  redirectPath: '/',

  // Banned paths
  bannedPaths: [],

  // Proxy port
  proxyPort: 8224,

  // Use external proxy server - IMPORTANT for Envato!
  useExternalProxy: true,  // ✅ Envato needs proxies

  // ✅ Asset domains to rewrite in HTML (dynamically uses current host)
  assetDomains: [
    { from: 'elements.envato.com', to: '' },  // ✅ Main domain - rewrite to root (no prefix)
    { from: 'assets.elements.envato.com', to: '/assets' },
    { from: 'elements-assets.envato.com', to: '/images' },
    { from: 'elements-resized.envatousercontent.com', to: '/images' },
    { from: 'account.envato.com', to: '/account' }
  ],

  // Domain replacement rules [find, replace] - DEPRECATED (use assetDomains instead)
  replaceRules: [],

  // Custom headers for requests
  customHeaders: {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'cache-control': 'max-age=0',
    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'accept-encoding': 'gzip'
  },

  // Custom cookies
  customCookies: {}
};