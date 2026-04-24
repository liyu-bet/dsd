const dns = require('dns/promises');
const tls = require('tls');

function extractPhpVersion(value) {
  if (!value) return null;
  const match = String(value).match(/php\/?\s*([0-9]+(?:\.[0-9]+){0,2})/i);
  return match ? match[1] : null;
}

function extractWpVersion(html) {
  if (!html) return null;
  const patterns = [
    /<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s*([0-9.]+)/i,
    /content=["']WordPress\s*([0-9.]+)["']/i,
    /wp-(?:content|includes)[^"'\s?]*[?&]ver=([0-9.]+)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function detectDbFromHtml(html) {
  if (!html) return null;
  if (/wordpress/i.test(html) || /wp-content|wp-includes/i.test(html)) return 'MySQL';
  if (/mariadb/i.test(html)) return 'MariaDB';
  return null;
}

function normalizeLanguageCode(value) {
  if (!value) return null;
  const raw = String(value)
    .replace(/_/g, '-')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (!raw) return null;
  const match = raw.match(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?/i);
  return match ? match[0] : null;
}

function collectLanguagesFromHtml(html, headers = {}) {
  const found = new Set();

  const add = (value) => {
    const normalized = normalizeLanguageCode(value);
    if (normalized) found.add(normalized);
  };

  add(headers.contentLanguage);
  add(headers.htmlLang);
  add(headers.ogLocale);

  const htmlLangMatch = html?.match(/<html[^>]+lang=["']([^"']+)["']/i);
  if (htmlLangMatch?.[1]) add(htmlLangMatch[1]);

  const generatorMatches = html?.matchAll(/hreflang=["']([^"']+)["']/gi) || [];
  for (const match of generatorMatches) add(match[1]);

  const contentLangMeta = html?.match(/<meta[^>]+http-equiv=["']content-language["'][^>]+content=["']([^"']+)["']/i);
  if (contentLangMeta?.[1]) add(contentLangMeta[1]);

  const ogLocaleMeta = html?.match(/<meta[^>]+property=["']og:locale["'][^>]+content=["']([^"']+)["']/i);
  if (ogLocaleMeta?.[1]) add(ogLocaleMeta[1]);

  const alternates = Array.from(found).filter((lang) => lang !== 'x-default');
  return {
    primaryLanguage: alternates[0] || null,
    languages: alternates,
  };
}

/**
 * @param {string} siteUrl
 * @param {string | undefined} [serverIp]
 */
async function checkSiteCore(siteUrl, serverIp = undefined) {
  let isUp = false;
  let pingMs = 0;
  let statusCode = 0;
  let isDnsValid = true;

  const techStack = {
    php: false,
    phpVersion: null,
    wordpress: false,
    wordpressVersion: null,
    db: false,
    html: true,
    cloudflare: false,
    proxied: false,
    ssl: null,
    resolvedIp: null,
    redirectUrl: null,
    serverHeader: null,
    primaryLanguage: null,
    languages: [],
  };

  const targetUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  const pureDomain = siteUrl.replace(/^https?:\/\//, '').split('/')[0];

  try {
    const ips = await dns.resolve4(pureDomain);
    techStack.resolvedIp = ips[0] || null;
    if (serverIp) isDnsValid = ips.includes(serverIp);
  } catch (_error) {
    if (serverIp) isDnsValid = false;
  }

  try {
    const sslData = await new Promise((resolve) => {
      const socket = tls.connect(
        443,
        pureDomain,
        { servername: pureDomain, rejectUnauthorized: false },
        () => {
          const cert = socket.getPeerCertificate();
          if (!cert || !cert.valid_to) {
            socket.end();
            return resolve(null);
          }
          const daysLeft = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          resolve({
            daysLeft,
            issuer: cert.issuer?.O || 'Unknown',
            validToDate: cert.valid_to,
          });
          socket.end();
        }
      );
      socket.on('error', () => resolve(null));
      socket.setTimeout(3000, () => {
        socket.destroy();
        resolve(null);
      });
    });

    if (sslData) techStack.ssl = sslData;
  } catch (_error) {}

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let hardTimeoutId;

    const fetchPromise = fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    const hardTimeoutPromise = new Promise((_, reject) => {
      hardTimeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Hard Timeout'));
      }, 11000);
    });

    const res = await Promise.race([fetchPromise, hardTimeoutPromise]);
    clearTimeout(timeoutId);
    clearTimeout(hardTimeoutId);

    pingMs = Date.now() - start;
    statusCode = res.status;
    isUp = res.ok || res.status < 400 || res.status === 401 || res.status === 403;

    const finalUrl = res.url;
    if (finalUrl && finalUrl.replace(/\/$/, '') !== targetUrl.replace(/\/$/, '')) {
      techStack.redirectUrl = finalUrl;
    }

    const serverHeader = res.headers.get('server') || '';
    const poweredBy = res.headers.get('x-powered-by') || '';
    const contentLanguageHeader = res.headers.get('content-language') || '';
    const htmlLangHeader = res.headers.get('html-lang') || '';
    const ogLocaleHeader = res.headers.get('x-og-locale') || '';
    techStack.serverHeader = serverHeader || null;

    if (serverHeader.toLowerCase().includes('cloudflare')) {
      techStack.cloudflare = true;
    }

    const phpVersion = extractPhpVersion(poweredBy) || extractPhpVersion(serverHeader);
    if (phpVersion) {
      techStack.php = true;
      techStack.phpVersion = phpVersion;
      techStack.html = false;
    } else if (/php/i.test(poweredBy) || siteUrl.endsWith('.php')) {
      techStack.php = true;
      techStack.html = false;
    }

    const html = await res.text().catch(() => '');
    const languageInfo = collectLanguagesFromHtml(html, {
      contentLanguage: contentLanguageHeader,
      htmlLang: htmlLangHeader,
      ogLocale: ogLocaleHeader,
    });
    techStack.primaryLanguage = languageInfo.primaryLanguage;
    techStack.languages = languageInfo.languages;

    const wpVersion = extractWpVersion(html);
    if (html.includes('wp-content') || html.includes('wp-includes') || html.includes('content="WordPress')) {
      techStack.wordpress = true;
      techStack.wordpressVersion = wpVersion;
      techStack.php = true;
      techStack.phpVersion = techStack.phpVersion || null;
      techStack.db = detectDbFromHtml(html) || 'MySQL';
      techStack.html = false;
    }

    if (!techStack.db) {
      techStack.db = detectDbFromHtml(html) || false;
    }
  } catch (_error) {
    isUp = false;
    pingMs = Date.now() - start;
    statusCode = 0;
  }

  if (serverIp && !isDnsValid) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const originRes = await fetch(`http://${serverIp}`, {
        headers: { Host: pureDomain },
        signal: controller.signal,
        redirect: 'manual',
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      if (originRes.status !== 404 && originRes.status !== 400) {
        isDnsValid = true;
        techStack.proxied = true;
      }
    } catch (_error) {}
  }

  return { isUp, pingMs, statusCode, isDnsValid, techStack };
}

module.exports = { checkSiteCore };
