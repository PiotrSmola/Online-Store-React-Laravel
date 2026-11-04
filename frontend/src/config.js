// Base URL of the Laravel backend.
// - Local dev (npm run dev): defaults to http://localhost:8000
// - Docker: built with VITE_API_URL=/ so requests go to the same origin
//   and nginx proxies /api and /storage to the backend container.
const rawApiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const API_URL = rawApiUrl.replace(/\/+$/, '');
