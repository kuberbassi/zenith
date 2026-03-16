import axios, { AxiosInstance } from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';
import { fetchAllIpuResultsWithClient } from '../src/services/ipuResultsFetcher.service.js';

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

async function testParallelFetching() {
  console.log('Testing Parallel Fetching Logic...');
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
        if (m) jar[m[1]] = m[2];
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
    // We won't actually login since we don't have credentials,
    // but we can test if the fetcher still parallelizes and fails correctly with session expiration 
    // when we pass a client that hasn't logged in.
    
    console.log('Invoking fetchAllIpuResultsWithClient (expecting session expiration since not logged in)...');
    const start = Date.now();
    try {
      await fetchAllIpuResultsWithClient(client as any, 3); // Fetch 3 semesters
      console.log('Unexpected success! It should have failed with session issues.');
    } catch (err: any) {
      const duration = Date.now() - start;
      console.log(`Fetch failed as expected after ${duration}ms`);
      console.log('Error Code:', err.code);
      console.log('Error Message:', err.message);
      
      if (err.code === 'SESSION_EXPIRED') {
        console.log('SUCCESS: Correctly detected SESSION_EXPIRED.');
      } else {
         console.log('FAILED: Incorrect error code:', err.code);
      }
    }

  } catch (err: any) {
    console.error('Test Error:', err.message);
  }
}

testParallelFetching();
