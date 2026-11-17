import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { StoreProvider } from './app/providers/StoreProvider';
import { AppRoutes } from './app/routes/AppRoutes';

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
} else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Clean up any previously registered dev service worker / Workbox cache on localhost
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        if (key.includes('workbox')) {
          caches.delete(key);
        }
      }
    });
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <StoreProvider>
      <AppRoutes />
    </StoreProvider>
  </React.StrictMode>
);
