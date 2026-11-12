import React from 'react';
import { C } from './ui';

// « À découvrir » : les articles et le Jambo, sur l'accueil du prêteur comme sur l'espace des proches.

const MiniCard: React.FC<{ r: number; red?: boolean; rot: number; x: number }> = ({ r, red, rot, x }) => (
  <div className="absolute w-[30px] h-[42px] rounded-[5px] bg-white serif font-bold text-[14px] pl-1 pt-0.5 shadow"
    style={{ transform: `rotate(${rot}deg)`, right: x, top: 12, color: red ? C.red : C.ink }}>{r}</div>
);

const Discover: React.FC<{ onArticles: () => void; onJambo: () => void }> = ({ onArticles, onJambo }) => (
  <>
    <div className="px-5 pt-7 pb-3 text-[17px] font-bold">À découvrir</div>
    <div className="px-5 grid grid-cols-2 gap-2.5">
      <button onClick={onArticles} className="relative text-left rounded-2xl p-4 pt-14 min-h-[128px] overflow-hidden" style={{ background: C.ochreSoft, color: C.ink }}>
        <div className="absolute top-4 left-4 serif text-[34px] leading-none font-semibold" style={{ color: C.ochre }} aria-hidden="true">«</div>
        <div className="serif text-[19px] font-semibold leading-tight">Articles</div>
        <div className="text-[12.5px] mt-0.5" style={{ color: C.ochreText }}>Les textes de Christian</div>
      </button>
      <button onClick={onJambo} className="relative text-left rounded-2xl p-4 pt-14 min-h-[128px] overflow-hidden text-white" style={{ background: '#16204A' }}>
        <MiniCard r={3} red rot={-12} x={46} />
        <MiniCard r={10} rot={8} x={18} />
        <div className="serif text-[19px] font-semibold leading-tight">Jambo</div>
        <div className="text-[12.5px] mt-0.5" style={{ color: 'rgba(255,255,255,.7)' }}>Fap Fap contre l'ordinateur</div>
      </button>
    </div>
  </>
);

export default Discover;
