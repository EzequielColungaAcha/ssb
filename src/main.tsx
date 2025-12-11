import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker.register(swUrl).then(
      (registration) => {
        console.log('ServiceWorker registered:', registration.scope);
      },
      (error) => {
        console.log('ServiceWorker registration failed:', error);
      }
    );
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  // Guard against missing root element to avoid runtime crash
  console.error('Root element with id="root" was not found in the document.');
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
