import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Wiseman from "./components/v2/Wiseman";

// Page publique du Wiseman (/wiseman, /wiseman?t=CODE) : on joue sans compte CKMoney.
const code = (() => {
  try { return (new URLSearchParams(window.location.search).get('t') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || undefined; }
  catch { return undefined; }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Wiseman playerName="" guest tableCode={code} />
  </React.StrictMode>
);
