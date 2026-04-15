// API Configuration
export const APIFY_CONFIG = {
  API_TOKEN: import.meta.env.VITE_APIFY_API_TOKEN ?? '',
  ACTOR_ID: '2dZb9qNraqcbL8CXP',
  BASE_URL: 'https://api.apify.com/v2',
  MAX_ATTEMPTS: 10,
  POLLING_INTERVAL: 2000, // 2 seconds
};
