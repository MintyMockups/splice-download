const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      throw new Error(`Splice returned status: ${response.status}`);
    }

    const html = await response.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application/json">(.*?)<\/script>/);
    let s3Url = null;

    function scanRecursively(obj) {
      if (!obj) return null;
      if (typeof obj === 'string') {
        if (obj.includes('s3') && obj.includes('amazonaws.com') && (obj.includes('.mp3') || obj.includes('.wav'))) {
          return obj;
        }
      } else if (typeof obj === 'object') {
        for (const key in obj) {
          const found = scanRecursively(obj[key]);
          if (found) return found;
        }
      }
      return null;
    }

    if (nextDataMatch) {
      try {
        const json = JSON.parse(nextDataMatch[1]);
        s3Url = scanRecursively(json);
      } catch (e) {}
    }

    if (!s3Url) {
      const s3Regex = /(https?:\/\/[a-zA-Z0-9\-\.]+\.s3[a-zA-Z0-9\-\.]*?\.amazonaws\.com\/audio_samples\/[^\s"'\>#\)]+)/g;
      const matches = html.match(s3Regex);
      if (matches && matches.length > 0) {
        s3Url = matches[0].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
      }
    }

    if (s3Url) {
      return res.status(200).json({ s3Url });
    } else {
      return res.status(404).json({ error: 'Could not extract S3 URL from this page.' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
