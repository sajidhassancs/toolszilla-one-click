export default {
  name: 'storyblocks',
  displayName: 'Storyblocks',
  domain: 'www.storyblocks.com',
  internalPaths: [],
  redirectPath: '/',
  bannedPaths: [],
  proxyPort: 8224,
  useExternalProxy: false,

  // ✅ Add this for better asset rewriting
  assetDomains: [
    { from: 'www.storyblocks.com', to: '' },
    { from: 'static.storyblocks.com', to: '/static' },
    { from: 'cdn.storyblocks.com', to: '/cdn' },
    { from: 'content.storyblocks.com', to: '/content' },
    { from: 'images.storyblocks.com', to: '/images' },
    { from: 'media.storyblocks.com', to: '/media' },
    { from: 'breadcrumbs.storyblocks.com', to: '/breadcrumbs' }
  ],

  replaceRules: [
    // Keep these as fallback
    ['static.storyblocks.com', 'dev-server.primewp.net/storyblocks/static'],
    ['cdn.storyblocks.com', 'dev-server.primewp.net/storyblocks/cdn'],
    ['content.storyblocks.com', 'dev-server.primewp.net/storyblocks/content'],
    ['images.storyblocks.com', 'dev-server.primewp.net/storyblocks/images'],
    ['media.storyblocks.com', 'dev-server.primewp.net/storyblocks/media']
  ],

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

  customCookies: {}
};