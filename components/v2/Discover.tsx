import React, { useState } from 'react';
import { C, Icon } from './ui';
import { dayNumber, puzzleFor, isOver, isWon, stats, MAX_TRIES } from '../../games/mot';

// Les deux cases encore utilisées de l'ancien « À découvrir » (remplacé par les onglets le 26/11) :
// le mot du jour (Entre amis) et l'invitation à rejoindre l'appli.

/** Case « Le mot du jour » : où on en est aujourd'hui, et la série. */
export const MotTile: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const n = dayNumber(), p = puzzleFor(n);
  let h: Record<string, string[]> = {};
  try { h = JSON.parse(localStorage.getItem('ck_mot') || '{}').h || {}; } catch { /* stockage indisponible */ }
  const g = h[n] || [], done = isOver(g, p.word), streak = stats(h, n).streak;
  const line = done ? (isWon(g, p.word) ? `Trouvé en ${g.length}/${MAX_TRIES}` : 'Raté aujourd’hui') : g.length ? `${g.length}/${MAX_TRIES} essais · à finir` : `${p.word.length} lettres${p.local ? ' · mot du 237' : ''} · à toi de jouer`;
  return (
    <button onClick={onClick} className="col-span-full text-left rounded-[10px] p-3.5 flex items-center gap-3.5" style={{ background: C.teal, color: C.ink }}>
      <span className="w-[54px] h-[54px] rounded-lg grid grid-cols-2 gap-[3px] p-[7px] shrink-0" style={{ background: C.ink }} aria-hidden="true">
        {[C.teal, C.mango, '#F7F3EA', C.teal].map((bg, i) => <span key={i} className="rounded-[4px]" style={{ background: bg }} />)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-extrabold uppercase tracking-wide">Le mot du jour · n° {n}</div>
        <div className="text-[16.5px] font-extrabold leading-snug mt-0.5">{done ? 'Reviens demain pour le prochain' : 'Un mot, six essais'}</div>
        <div className="text-[12.5px] mt-0.5 truncate font-semibold" style={{ color: 'rgba(14,21,51,.78)' }}>{line}{streak > 0 ? ` · série de ${streak} jour${streak > 1 ? 's' : ''}` : ''}</div>
      </div>
      <span style={{ color: C.ink }}><Icon name="chevron" size={18} /></span>
    </button>
  );
};

const INVITE_TEXT = "Rejoins-moi sur CKMoney : l'info du jour, le mot du jour, les films et séries, les sorties, Radio CK et des jeux entre amis. C'est gratuit.";
const INVITE_URL = 'https://ck-money.vercel.app';

/** « Inviter un ami » : partage l'appli elle-même (pas un lien de demande de prêt). */
export const InviteCard: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = { title: 'CKMoney', text: INVITE_TEXT, url: INVITE_URL };
    if (typeof navigator.share === 'function') {
      try { await navigator.share(data); return; } catch (e: any) { if (e?.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${INVITE_TEXT}\n${INVITE_URL}`)}`, '_blank', 'noopener');
  };
  const copy = () => { navigator.clipboard?.writeText(`${INVITE_TEXT}\n${INVITE_URL}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => undefined); };
  return (
    <div className="px-5 pt-7">
      <div className="rounded-[10px] p-4" style={{ background: C.teal, color: C.ink }}>
        <div className="display text-[17px] leading-tight">Fais découvrir CKMoney</div>
        <p className="text-[14px] leading-snug mt-1.5 font-semibold" style={{ color: 'rgba(14,21,51,.8)' }}>Invite un ami à rejoindre l’appli : l’info du jour, le mot du jour, les films, les sorties… Rien à voir avec un prêt.</p>
        <div className="grid grid-cols-[1fr_auto] gap-2 mt-3.5">
          <button onClick={share} className="h-12 rounded-xl flex items-center justify-center gap-2 text-[15px] font-extrabold" style={{ background: C.ink, color: '#fff' }}>
            <Icon name="chat" size={19} /> Inviter un ami
          </button>
          <button onClick={copy} aria-label="Copier le lien de l’appli" className="h-12 px-4 rounded-xl flex items-center justify-center gap-1.5 text-[14px] font-bold" style={{ background: 'rgba(14,21,51,.12)', color: C.ink }}>
            <Icon name="copy" size={18} /> {copied ? 'Copié' : 'Lien'}
          </button>
        </div>
      </div>
    </div>
  );
};
