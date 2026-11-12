import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Bac from './components/v2/Bac';

// Page publique du Baccalauréat (/bac, /bac?t=CODE) : on joue sans compte CKMoney.
const code = (() => {
  try { return (new URLSearchParams(window.location.search).get('t') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || undefined; }
  catch { return undefined; }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Bac playerName="" guest tableCode={code} />
  </React.StrictMode>
);
