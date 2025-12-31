import axios from 'axios';

// Construct backend URL dynamically based on current hostname
// This ensures cookies work correctly from any device on the network
const getBackendUrl = () => {
  // In development on localhost, use the proxy (empty base)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '';
  }
  // On other hosts (like nip.io), connect directly to backend
  const backendPort = 3001;
  return `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
};

const api = axios.create({
  baseURL: `${getBackendUrl()}/api`,
  withCredentials: true
});

export default api;
