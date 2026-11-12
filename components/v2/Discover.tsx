import React from 'react';
import { C } from './ui';

// « À découvrir » : les articles et les jeux, sur l'accueil du prêteur comme sur l'espace des proches.

const MiniCard: React.FC<{ r: number; red?: boolean; rot: number; x: number }> = ({ r, red, rot, x }) => (
  <div className="absolute w-[30px] h-[42px] rounded-[5px] bg-white serif font-bold text-[14px] pl-1 pt-0.5 shadow"
    style={{ transform: `rotate(${rot}deg)`, right: x, top: 12, color: red ? C.red : C.ink }}>{r}</div>
);

const Tile: React.FC<{ onClick: () => void; title: string; sub: string; bg: string; fg: string; subColor: string; children?: React.ReactNode }> = ({ onClick, title, sub, bg, fg, subColor, children }) => (
  <button onClick={onClick} className="relative text-left rounded-2xl p-4 pt-14 min-h-[128px] overflow-hidden" style={{ background: bg, color: fg }}>
    {children}
    <div className="serif text-[19px] font-semibold leading-tight">{title}</div>
    <div className="text-[12.5px] mt-0.5" style={{ color: subColor }}>{sub}</div>
  </button>
);

const Discover: React.FC<{ onArticles: () => void; onJambo: () => void; onBac: () => void; onWiseman: () => void }> = ({ onArticles, onJambo, onBac, onWiseman }) => (
  <>
    <div className="px-5 pt-7 pb-3 text-[17px] font-bold">À découvrir</div>
    <div className="px-5 grid grid-cols-2 gap-2.5">
      <Tile onClick={onArticles} title="Articles" sub="Les textes de Christian" bg={C.ochreSoft} fg={C.ink} subColor={C.ochreText}>
        <div className="absolute top-4 left-4 serif text-[34px] leading-none font-semibold" style={{ color: C.ochre }} aria-hidden="true">«</div>
      </Tile>
      <Tile onClick={onJambo} title="Jambo" sub="Fap Fap, seul ou entre amis" bg="#16204A" fg="#fff" subColor="rgba(255,255,255,.7)">
        <MiniCard r={3} red rot={-12} x={46} />
        <MiniCard r={10} rot={8} x={18} />
      </Tile>
      <Tile onClick={onBac} title="Baccalauréat" sub="Le petit bac, sans feuille ni stylo" bg={C.card} fg={C.ink} subColor={C.mute}>
        <div className="absolute top-3.5 left-4 w-10 h-10 rounded-xl flex items-center justify-center serif text-[24px] font-semibold" style={{ background: C.ink, color: C.ochre }} aria-hidden="true">B</div>
      </Tile>
      <Tile onClick={onWiseman} title="Le Wiseman" sub="Trouve l'intrus parmi vous" bg={C.card} fg={C.ink} subColor={C.mute}>
        <div className="absolute top-3.5 left-4 flex -space-x-2" aria-hidden="true">
          {[C.soft, C.ochreSoft, C.ink].map((bg, i) => (
            <span key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[13px] font-bold" style={{ background: bg, color: i === 2 ? C.ochre : C.ink }}>{i === 2 ? '?' : ''}</span>
          ))}
        </div>
      </Tile>
    </div>
  </>
);

export default Discover;
