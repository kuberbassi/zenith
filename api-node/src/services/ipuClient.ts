import axios from 'axios';
import { Cookie } from 'playwright'; // Using the interface for type compatibility, though we use axios

export interface IpuScraperResponse {
    nrollno: string;
    stname: string;
    byoa: number;
    yoa: number;
    father: string;
    prgcode: string;
    prgname: string;
    icode: string;
    iname: string;
    euno: number;
    papercode: string;
    papername: string;
    minorprint: string;
    majorprint: string;
    moderatedprint: string;
    statuscode: string;
    rmonth: number;
    ryear: number;
    declareddate: string;
    eugpa: number;
}

/**
 * Fetches academic results directly from the IPU portal using HTTP requests.
 * Mimics a browser request using the provided session cookie.
 */
export async function fetchIpuResults(cookies: Cookie[] | string, semester: number = 1): Promise<IpuScraperResponse[]> {
    const url = `https://examweb.ggsipu.ac.in/web/StudentSearchProcess?flag=2&euno=${semester}`;

    // Convert Playwright cookies or string to Axios compatible Cookie string
    const cookieString = typeof cookies === 'string'
        ? cookies
        : cookies.map(c => `${c.name}=${c.value}`).join('; ');

    try {
        const response = await axios.get(url, {
            headers: {
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cookie': cookieString,
                'Referer': 'https://examweb.ggsipu.ac.in/web/student/studenthome.jsp',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Sec-GPC': '1',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 15000
        });

        if (response.status === 200 && Array.isArray(response.data)) {
            return response.data as IpuScraperResponse[];
        }

        if (response.status === 401) {
            throw new Error('Session expired. Please log in again.');
        }

        throw new Error(`IPU Server returned status ${response.status}`);
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401) throw new Error('Session expired. Please log in again.');
            if (error.response?.status === 403) throw new Error('Access forbidden. Session may be invalid.');
            throw new Error(`HTTP Error: ${error.message}`);
        }
        throw error;
    }
}
