/**
 * Scraper Service — v1 API
 *
 * IPU notices.
 */

import api from './api';

export const getNotices = async () => {
  const { data } = await api.get('/api/scraper/notices');
  return data;
};

export default { getNotices };
