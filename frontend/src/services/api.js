import axios from 'axios';

// Construct backend URL based on environment
const getBackendUrl = () => {
  // In production, use VITE_API_URL if defined, otherwise use same origin
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In development on localhost, use the proxy (empty base)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '';
  }
  // On other hosts (like nip.io in dev), connect directly to backend
  const backendPort = 3001;
  return `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
};

const api = axios.create({
  baseURL: `${getBackendUrl()}/api`,
  withCredentials: true
});

export default api;
