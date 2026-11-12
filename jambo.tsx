import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Jambo from './components/v2/Jambo';

// Page publique du Jambo (/jambo) : contre l'ordinateur sans rien charger d'autre, ou en ligne
// avec des amis (/jambo?t=CODE) ; Firebase n'est chargé que pour le jeu en ligne.
const code = (() => {
  try { return (new URLSearchParams(window.location.search).get('t') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || undefined; }
  catch { return undefined; }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Jambo playerName="" guest tableCode={code} />
  </React.StrictMode>
);
