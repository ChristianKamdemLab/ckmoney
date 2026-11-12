import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Jambo from './components/v2/Jambo';

// Page publique du Jambo (/jambo) : on joue sans compte, rien n'est envoyé ni enregistré en ligne.
// Elle ne charge pas Firebase : seulement le jeu.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Jambo playerName="" guest />
  </React.StrictMode>
);
