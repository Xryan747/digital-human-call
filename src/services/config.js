// Server URL configuration
// In web mode, uses current hostname. In native app, uses localStorage override.

const STORAGE_KEY = 'server_url';

function getDefaultServer() {
  const host = window.location.hostname;
  // If running as PWA/native app (file:// or capacitor://), default to localhost
  if (host === '' || host === 'localhost' || host === '127.0.0.1') {
    return 'localhost';
  }
  return host;
}

export function getServerHost() {
  // Check for user override
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  // Use default
  return getDefaultServer();
}

export function getServerUrl() {
  const host = getServerHost();
  const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${proto}//${host}:3000`;
}

export function getWsUrl() {
  const host = getServerHost();
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${host}:3000`;
}

export function setServerHost(host) {
  localStorage.setItem(STORAGE_KEY, host);
}

export function clearServerHost() {
  localStorage.removeItem(STORAGE_KEY);
}
