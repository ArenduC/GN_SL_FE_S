
import React from 'react';
import ReactDOM from 'react-dom/client';
import { StoreProvider } from './app/providers/StoreProvider';
import { AppRoutes } from './app/routes/AppRoutes';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <StoreProvider>
      <AppRoutes />
    </StoreProvider>
  </React.StrictMode>
);

