
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { InstallFromLink } from './components/v2/Install';
import { initInstall } from './services/install';

// L'invite d'installation d'Android n'arrive qu'une fois, au chargement : on la garde tout de suite.
initInstall();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
    <InstallFromLink />
  </React.StrictMode>
);

// Appli installable (PWA) : enregistrement du service worker en production uniquement.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker non enregistré', err));
  });
}
