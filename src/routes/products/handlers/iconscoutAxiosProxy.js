// For HTML, rewrite URLs
if (contentType.includes('text/html')) {
  let html = response.data.toString('utf-8');

  console.log('🔧 Rewriting HTML URLs...');

  // ✅ CRITICAL: Add base tag FIRST (like Epidemic Sound)
  const baseTag = '<base href="/iconscout/">';
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${baseTag}</head>`);
    console.log('   ✅ Injected base tag for SPA routing');
  }

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

  // ✅ DO NOT ADD PREFIX - Base tag handles routing
  // Remove these lines:
  // html = html.replace(/href="\/(?!iconscout)/g, 'href="/iconscout/');
  // html = html.replace(/src="\/(?!iconscout)/g, 'src="/iconscout/');

  // ✅ CRITICAL: Inject CDN URL override script with /image prefix
  const cdnOverrideScript = `
    <script>
    (function() {
      console.log('🎨 Iconscout CDN override initialized');
      
      // Override Image constructor
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
      
      // Override setAttribute for existing images
      const originalSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        if (name === 'src' && this.tagName === 'IMG' && typeof value === 'string') {
          value = value
            .replace(/https:\\/\\/cdn3d\\.iconscout\\.com/g, '${currentHost}/iconscout/image/cdn3d')
            .replace(/https:\\/\\/cdna\\.iconscout\\.com/g, '${currentHost}/iconscout/image/cdna')
            .replace(/https:\\/\\/cdn\\.iconscout\\.com/g, '${currentHost}/iconscout/image/cdn');
        }
        return originalSetAttribute.call(this, name, value);
      };
      
      console.log('✅ CDN override ready');
    })();
    </script>
  `;

  // Inject script right after <head> tag
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>${cdnOverrideScript}`);
    console.log('   ✅ Injected CDN override script');
  }

  console.log('   ✅ HTML rewriting complete (URLs kept clean with base tag)');

  res.set('Content-Type', 'text/html');
  return res.status(response.status).send(html);
}