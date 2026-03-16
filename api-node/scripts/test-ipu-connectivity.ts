import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

const IPU_BASE = 'https://examweb.ggsipu.ac.in';
const IPU_LOGIN_URL = `${IPU_BASE}/web/login.jsp`;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
};

async function testConnectivity() {
  console.log('Testing connectivity to IPU portal...');
  const jar: Record<string, string> = {};
  const client = axios.create({
    headers: HEADERS,
    timeout: 20_000,
    maxRedirects: 5,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });

  client.interceptors.response.use((resp) => {
    const setCookies = resp.headers['set-cookie'];
    if (setCookies) {
      for (const raw of setCookies) {
        const m = raw.match(/^([^=]+)=([^;]*)/);
        if (m) {
          jar[m[1]] = m[2];
          console.log(`[Cookie] Set ${m[1]}=${m[2]}`);
        }
      }
    }
    return resp;
  });

  client.interceptors.request.use((cfg) => {
    const cookieStr = Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (cookieStr) cfg.headers.Cookie = cookieStr;
    return cfg;
  });

  try {
    console.log(`GET ${IPU_LOGIN_URL}`);
    const resp = await client.get(IPU_LOGIN_URL);
    console.log(`Status: ${resp.status}`);
    const $ = cheerio.load(resp.data);
    const title = $('title').text().trim();
    console.log(`Title: ${title}`);

    let img = $('img#captchaImage, img#captcha');
    if (!img.length) img = $('img[class*="captcha" i]');
    if (!img.length) img = $('img[src*="captcha" i], img[src*="kaptcha" i]');

    if (img.length) {
      const src = img.attr('src') || '';
      console.log(`Found CAPTCHA image: ${src}`);
      const captchaUrl = src.startsWith('http') ? src : `${IPU_BASE}/web/${src}`;
      console.log(`Full CAPTCHA URL: ${captchaUrl}`);

      console.log(`GET ${captchaUrl}`);
      const imgResp = await client.get(captchaUrl, { responseType: 'arraybuffer' });
      console.log(`CAPTCHA Response Status: ${imgResp.status}`);
      console.log(`CAPTCHA Content-Length: ${imgResp.headers['content-length']}`);
    } else {
      console.log('CAPTCHA image NOT found!');
    }

    console.log('Current Cookies:', jar);

  } catch (err: any) {
    console.error('Error during connectivity test:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Data:', err.response.data);
    }
  }
}

testConnectivity();
