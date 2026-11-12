import React, { useState } from 'react';
import { Button, Sheet, Icon, C } from './ui';
import {
  Card, Suit, Play, RoundResult, legalCards, claimOf, currentBest, isRed, cardName, sameCard, CLAIM_LABEL, SUIT_NAME, POINTS,
} from '../../games/fapfap';

// Table du Jambo, commune au jeu contre l'ordinateur et au jeu en ligne.
// Tout est exprimé du point de vue du joueur : l'indice 0, c'est « toi ».

export const FELT = '#16204A';

const SuitIcon: React.FC<{ s: Suit; size?: number; color?: string }> = ({ s, size = 16, color }) => {
  const d: Record<Suit, string> = {
    coeur: 'M12 21s-7.6-4.7-9.7-9.4C.8 8.1 3 4.4 6.6 4.4c2.1 0 3.6 1.2 4.4 2.7.8-1.5 2.3-2.7 4.4-2.7 3.6 0 5.8 3.7 4.3 7.2C19.6 16.3 12 21 12 21z',
    carreau: 'M12 2.2 20 12l-8 9.8L4 12z',
    pique: 'M12 2.5s-8 6.1-8 11c0 2.8 2 4.8 4.5 4.8 1.3 0 2.4-.5 3-1.2-.2 1.9-1 3.4-2.5 4.6h6c-1.5-1.2-2.3-2.7-2.5-4.6.6.7 1.7 1.2 3 1.2 2.5 0 4.5-2 4.5-4.8 0-4.9-8-11-8-11z',
    trefle: 'M12 2.6a4.1 4.1 0 0 0-3.9 5.3 4.1 4.1 0 1 0 1.4 7.7c.8 0 1.5-.2 2.1-.6-.2 2.5-1 4.4-2.6 5.7h6c-1.6-1.3-2.4-3.2-2.6-5.7.6.4 1.3.6 2.1.6a4.1 4.1 0 1 0 1.4-7.7A4.1 4.1 0 0 0 12 2.6z',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={d[s]} fill={color || (isRed(s) ? C.red : C.ink)} /></svg>;
};

export const CardFace: React.FC<{ card: Card; w?: number; dim?: boolean; glow?: boolean; lift?: boolean }> = ({ card, w = 64, dim, glow, lift }) => {
  const color = isRed(card.s) ? C.red : C.ink;
  const h = Math.round(w * 1.42);
  return (
    <div className="relative rounded-[10px] bg-white select-none transition-transform" aria-label={cardName(card)}
      style={{
        width: w, height: h, color, opacity: dim ? 0.42 : 1,
        boxShadow: glow ? `0 0 0 3px ${C.ochre}, 0 6px 16px rgba(0,0,0,.35)` : '0 2px 6px rgba(0,0,0,.28)',
        transform: lift ? 'translateY(-10px)' : undefined,
      }}>
      <div className="absolute top-1.5 left-2 flex flex-col items-center leading-none">
        <span className="serif font-bold" style={{ fontSize: w * 0.33 }}>{card.r}</span>
        <span className="mt-0.5"><SuitIcon s={card.s} size={w * 0.2} /></span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pt-[18%] pl-[22%]"><SuitIcon s={card.s} size={w * 0.48} /></div>
    </div>
  );
};

export const CardBack: React.FC<{ w?: number }> = ({ w = 22 }) => (
  <div className="rounded-[4px]" style={{
    width: w, height: Math.round(w * 1.42), border: '1.5px solid rgba(255,255,255,.85)',
    background: `repeating-linear-gradient(45deg, ${C.ochre} 0 3px, #A9721A 3px 6px)`,
  }} />
);

// ---------- Statistiques (sur ce téléphone uniquement)
const STATS_KEY = 'ck_jambo_stats';
export const readStats = (): { played: number; won: number } => {
  try { return { played: 0, won: 0, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') }; } catch { return { played: 0, won: 0 }; }
};
export const saveStats = (won: boolean) => {
  try { const s = readStats(); localStorage.setItem(STATS_KEY, JSON.stringify({ played: s.played + 1, won: s.won + (won ? 1 : 0) })); } catch { /* stockage indisponible */ }
};

export const RulesSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Sheet open={open} onClose={onClose} title="Règles du Fap Fap">
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed" style={{ color: C.text2 }}>
      <p>31 cartes, du 3 au 10 (le 10 de pique est écarté). Chacun reçoit 5 cartes. Les familles : Koubi (cœur), Zing (carreau), pique et trèfle.</p>
      <p>Le <b>commandant</b> ouvre le pli. Les autres doivent fournir la famille demandée s'ils en ont, sinon ils jettent la carte de leur choix.</p>
      <p>La plus forte carte de la famille demandée remporte le pli, et son joueur commande le suivant. <b>Celui qui remporte le 5e et dernier pli gagne la manche</b> : {POINTS.normal} point.</p>
      <p><b>Kora</b> : gagner le dernier pli avec un 3 rapporte {POINTS.kora} points. <b>Double Kora</b> : les deux derniers plis avec des 3, {POINTS.doubleKora} points.</p>
      <p><b>Annonce</b> : à ton premier tour, avec 21 ou moins (somme des cartes), trois 3, trois 7, un carré ou cinq cartes de la même famille, tu peux annoncer et gagner la manche tout de suite ({POINTS.claim} point).</p>
      <p className="serif italic" style={{ color: C.ink }}>Le Jambo n'aime pas la panique : ne garde pas tes grosses cartes pour rien, mais n'abats pas ta meilleure trop tôt.</p>
    </div>
  </Sheet>
);

// ---------- Table

export interface TableModel {
  names: string[];
  bots: boolean[];
  scores: number[];
  counts: number[];
  myHand: Card[];
  target: number;
  round: number;
  trickNo: number;
  leader: number;
  turn: number | null;
  trick: Play[];
  result: RoundResult | null;
  matchWinner: number | null;
}

export interface TableProps {
  m: TableModel;
  banner?: string | null;       // « Tonton remporte le pli »
  locked?: boolean;             // pli en cours d'affichage : on ne joue pas
  secondsLeft?: number | null;  // jeu en ligne : temps restant au joueur dont c'est le tour
  note?: string | null;         // jeu en ligne : « L'ordinateur a joué pour Paul »
  showResult: boolean;
  onPlay: (c: Card) => void;
  onClaim: () => void;
  onNext: () => void;
  onReplay: () => void;
  replayLabel?: string;
  onQuit: () => void;
  quitTitle: string;
  quitText: string;
  topLabel?: string;            // ex. « Table K7PM3Q »
}

const label = (m: TableModel, i: number) => (i === 0 ? 'Toi' : m.names[i]);

export const TableView: React.FC<TableProps> = ({ m, banner, locked, secondsLeft, note, showResult, onPlay, onClaim, onNext, onReplay, replayLabel = 'Rejouer', onQuit, quitTitle, quitText, topLabel }) => {
  const [rules, setRules] = useState(false);
  const [quit, setQuit] = useState(false);
  const [sent, setSent] = useState(false);
  const me = m.myHand;
  const myTurn = m.turn === 0 && !m.result && !locked;
  const legal = myTurn ? legalCards(me, m.trick) : [];
  const myClaim = myTurn && m.trickNo === 1 && me.length === 5 ? claimOf(me) : null;
  const best = currentBest(m.trick);
  const led = m.trick[0]?.c.s as Suit | undefined;
  const secs = secondsLeft !== null && secondsLeft !== undefined && secondsLeft <= 30 ? ` · ${Math.max(0, secondsLeft)} s` : '';
  const status = m.result ? '' : banner ? banner
    : myTurn ? (led && me.some(c => c.s === led) ? `À toi : fournis du ${SUIT_NAME[led]}` : m.trick.length ? 'À toi : tu n’as pas la famille, jette une carte' : m.trickNo === 5 ? 'À toi : dernier pli, tu commandes' : 'À toi de commander') + secs
    : m.turn !== null && m.turn !== undefined ? `${m.names[m.turn]} ${m.bots[m.turn] ? 'réfléchit…' : 'joue…'}${m.bots[m.turn] ? '' : secs}` : '';

  const cardW = Math.min(70, Math.floor((Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, 480) - 40 - 4 * 8) / 5));
  const opp = m.names.map((_, i) => i).slice(1);
  const r = m.result;
  const resultText = r && (r.kind === 'claim'
    ? `Annonce : ${CLAIM_LABEL[r.claim!].toLowerCase()}.`
    : r.kind === 'kora' ? `Kora ! Dernier pli remporté avec le ${cardName(r.card!)}.`
    : r.kind === 'doubleKora' ? 'Double Kora ! Les deux derniers plis remportés avec des 3.'
    : `Dernier pli remporté avec le ${cardName(r.card!)}.`);
  const play = (c: Card) => { if (!sent) { setSent(true); onPlay(c); setTimeout(() => setSent(false), 600); } };
  const badge = <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: C.ochre, color: C.ink }} title="Commandant">C</span>;

  return (
    <div className="min-h-[100dvh] w-full flex justify-center text-white" style={{ background: `radial-gradient(120% 80% at 50% 40%, #233067 0%, ${FELT} 60%, #0F1735 100%)` }}>
      <div className="w-full max-w-[480px] flex flex-col min-h-[100dvh]">
        <div className="flex items-center gap-1 px-3 pt-[max(env(safe-area-inset-top),16px)] min-h-[56px]">
          <button onClick={() => setQuit(true)} aria-label="Quitter" className="w-11 h-11 flex items-center justify-center rounded-full active:bg-white/10"><Icon name="close" /></button>
          <div className="flex-1 text-center text-[14px] font-semibold leading-tight" style={{ color: 'rgba(255,255,255,.8)' }}>
            Manche {m.round} · pli {Math.min(m.trickNo, 5)} sur 5
            {topLabel && <div className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,.5)' }}>{topLabel}</div>}
          </div>
          <button onClick={() => setRules(true)} aria-label="Règles" className="w-11 h-11 flex items-center justify-center rounded-full active:bg-white/10"><Icon name="info" /></button>
        </div>

        <div className="px-4 flex gap-2 overflow-x-auto">
          {m.names.map((_, i) => (
            <div key={i} className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-semibold shrink-0"
              style={{ background: m.turn === i && !m.result ? C.ochre : 'rgba(255,255,255,.1)', color: m.turn === i && !m.result ? C.ink : '#fff' }}>
              {label(m, i)}<span className="tabular-nums font-bold">{m.scores[i]}</span>
            </div>
          ))}
          <div className="h-8 px-2 flex items-center text-[12px] shrink-0" style={{ color: 'rgba(255,255,255,.55)' }}>sur {m.target}</div>
        </div>

        <div className={`px-4 pt-5 grid gap-2 ${opp.length === 1 ? 'grid-cols-1' : opp.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {opp.map(i => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold max-w-full">
                {m.leader === i && !m.result && badge}
                <span className="truncate">{m.names[i]}</span>
              </div>
              <div className="flex -space-x-2.5 min-h-[31px]">{Array.from({ length: m.counts[i] || 0 }, (_, j) => <CardBack key={j} />)}</div>
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 min-h-[190px]">
          <div className="flex flex-wrap justify-center gap-3">
            {m.trick.map(t => (
              <div key={`${t.p}-${t.c.r}${t.c.s}`} className="flex flex-col items-center gap-1.5 animate-[fadeUp_.25s_ease-out]">
                <CardFace card={t.c} w={60} glow={best?.p === t.p && m.trick.length > 1} />
                <span className="text-[12px] font-semibold max-w-[70px] truncate" style={{ color: 'rgba(255,255,255,.75)' }}>{label(m, t.p)}</span>
              </div>
            ))}
            {!m.trick.length && !m.result && (
              <div className="text-[13px] text-center max-w-[220px]" style={{ color: 'rgba(255,255,255,.5)' }}>
                {m.leader === 0 ? 'Tu commandes ce pli : choisis la famille avec ta carte.' : `${m.names[m.leader]} commande ce pli.`}
              </div>
            )}
          </div>
          <div className="min-h-6 mt-4 text-[14px] font-semibold text-center" role="status" style={{ color: banner ? C.ochre : 'rgba(255,255,255,.85)' }}>{status}</div>
          {note && <div className="text-[12px] mt-1 text-center" style={{ color: 'rgba(255,255,255,.55)' }}>{note}</div>}
        </div>

        {myClaim && (
          <div className="px-4 pb-3">
            <button onClick={onClaim} className="w-full h-12 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: C.ochre, color: C.ink }}>
              Annoncer : {CLAIM_LABEL[myClaim].toLowerCase()}
            </button>
          </div>
        )}

        <div className="px-4 pt-3 pb-[max(env(safe-area-inset-bottom),20px)]" style={{ background: 'rgba(0,0,0,.18)' }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold">{m.leader === 0 && !m.result && badge}Ta main</div>
            <div className="text-[12px]" style={{ color: 'rgba(255,255,255,.55)' }}>Somme : {me.reduce((a, c) => a + c.r, 0)}</div>
          </div>
          <div className="flex justify-center gap-2 min-h-[100px] pt-2.5">
            {me.slice().sort((a, b) => a.s.localeCompare(b.s) || a.r - b.r).map(card => {
              const ok = legal.some(sameCard(card));
              return (
                <button key={`${card.r}${card.s}`} disabled={!ok || sent} onClick={() => play(card)} aria-label={`Jouer le ${cardName(card)}`}>
                  <CardFace card={card} w={cardW} dim={myTurn && !ok} lift={myTurn && ok} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Les panneaux reprennent l'encre : la table est en blanc sur fond sombre */}
      <div style={{ color: C.ink }}>
        <Sheet open={showResult && !!r} onClose={() => undefined} title={m.matchWinner !== null
          ? (m.matchWinner === 0 ? 'Tu remportes la partie' : `${m.names[m.matchWinner]} remporte la partie`)
          : r?.winner === 0 ? 'Tu gagnes la manche' : `${r ? m.names[r.winner] : ''} gagne la manche`}>
          {r && (
            <div className="flex flex-col gap-4" style={{ color: C.ink }}>
              <p className="text-[15px]" style={{ color: C.text2 }}>{resultText} <b>+{r.points} point{r.points > 1 ? 's' : ''}</b></p>
              {r.hand && <div className="flex gap-1.5">{r.hand.map(c => <CardFace key={`${c.r}${c.s}`} card={c} w={48} />)}</div>}
              <div className="rounded-2xl bg-white">
                {m.names.map((_, i) => i).sort((a, b) => m.scores[b] - m.scores[a]).map((i, k) => (
                  <div key={i} className="flex justify-between px-4 py-3 text-[15px]" style={{ borderTop: k ? `1px solid ${C.line}` : undefined }}>
                    <span className="font-semibold">{label(m, i)}</span>
                    <span className="font-bold tabular-nums">{m.scores[i]} pt{m.scores[i] > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
              {m.matchWinner !== null ? (
                <div className="flex flex-col gap-2.5">
                  <Button onClick={onReplay}>{replayLabel}</Button>
                  <Button variant="secondary" onClick={onQuit}>Quitter la table</Button>
                </div>
              ) : <Button onClick={onNext}>Manche suivante</Button>}
            </div>
          )}
        </Sheet>
        <Sheet open={quit} onClose={() => setQuit(false)} title={quitTitle}>
          <p className="text-[15px] mb-4" style={{ color: C.text2 }}>{quitText}</p>
          <div className="flex flex-col gap-2.5">
            <Button onClick={onQuit}>Quitter</Button>
            <Button variant="secondary" onClick={() => setQuit(false)}>Continuer à jouer</Button>
          </div>
        </Sheet>
        <RulesSheet open={rules} onClose={() => setRules(false)} />
      </div>
    </div>
  );
};
