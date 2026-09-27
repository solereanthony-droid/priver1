import { useSyncExternalStore } from 'react';

const subscribe = cb => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
};

// true si le navigateur a du réseau (utile sur les chantiers mal couverts).
export const useOnlineStatus = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
