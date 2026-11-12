import React, { useEffect, useRef, useState } from 'react';
import { Screen, TopBar, Button, Chips, Sheet, Note, Icon, C, firstName } from './ui';
import {
  Game, Card, Suit, newGame, nextRound, play, claim, resolveTrick, aiMove, legalCards, canClaim, currentBest,
  isRed, cardName, sameCard, CLAIM_LABEL, SUIT_NAME, POINTS,
} from '../../games/fapfap';

// Jambo (Fap Fap) contre l'ordinateur. Des points, jamais d'argent.

const FELT = '#16204A';
const BOTS = ['Tonton', 'La Go', 'Le Boss'];

const SuitIcon: React.FC<{ s: Suit; size?: number; color?: string }> = ({ s, size = 16, color }) => {
  const d: Record<Suit, string> = {
    coeur: 'M12 21s-7.6-4.7-9.7-9.4C.8 8.1 3 4.4 6.6 4.4c2.1 0 3.6 1.2 4.4 2.7.8-1.5 2.3-2.7 4.4-2.7 3.6 0 5.8 3.7 4.3 7.2C19.6 16.3 12 21 12 21z',
    carreau: 'M12 2.2 20 12l-8 9.8L4 12z',
    pique: 'M12 2.5s-8 6.1-8 11c0 2.8 2 4.8 4.5 4.8 1.3 0 2.4-.5 3-1.2-.2 1.9-1 3.4-2.5 4.6h6c-1.5-1.2-2.3-2.7-2.5-4.6.6.7 1.7 1.2 3 1.2 2.5 0 4.5-2 4.5-4.8 0-4.9-8-11-8-11z',
    trefle: 'M12 2.6a4.1 4.1 0 0 0-3.9 5.3 4.1 4.1 0 1 0 1.4 7.7c.8 0 1.5-.2 2.1-.6-.2 2.5-1 4.4-2.6 5.7h6c-1.6-1.3-2.4-3.2-2.6-5.7.6.4 1.3.6 2.1.6a4.1 4.1 0 1 0 1.4-7.7A4.1 4.1 0 0 0 12 2.6z',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={d[s]} fill={color || (isRed(s) ? C.red : C.ink)} /></svg>;
};

const CardFace: React.FC<{ card: Card; w?: number; dim?: boolean; glow?: boolean; lift?: boolean }> = ({ card, w = 64, dim, glow, lift }) => {
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

const CardBack: React.FC<{ w?: number }> = ({ w = 22 }) => (
  <div className="rounded-[4px]" style={{
    width: w, height: Math.round(w * 1.42), border: '1.5px solid rgba(255,255,255,.85)',
    background: `repeating-linear-gradient(45deg, ${C.ochre} 0 3px, #A9721A 3px 6px)`,
  }} />
);

// ---------- Statistiques (sur ce téléphone uniquement)
const STATS_KEY = 'ck_jambo_stats';
const readStats = (): { played: number; won: number } => {
  try { return { played: 0, won: 0, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') }; } catch { return { played: 0, won: 0 }; }
};
const saveStats = (won: boolean) => {
  try { const s = readStats(); localStorage.setItem(STATS_KEY, JSON.stringify({ played: s.played + 1, won: s.won + (won ? 1 : 0) })); } catch { /* stockage indisponible */ }
};

const RulesSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
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

// ---------- Mise en place

const shareText = () => `Viens jouer au Fap Fap contre l'ordinateur. Gratuit, sans compte, on joue pour des points : ${window.location.origin}/jambo`;

const Setup: React.FC<{ onStart: (bots: number, target: number) => void; onBack?: () => void; guest?: boolean }> = ({ onStart, onBack, guest }) => {
  const [bots, setBots] = useState('2');
  const [target, setTarget] = useState('10');
  const [rules, setRules] = useState(false);
  const stats = readStats();
  return (
    <Screen>
      <TopBar onBack={onBack} title="Jambo" right={<button onClick={() => setRules(true)} aria-label="Règles" className="w-11 h-11 flex items-center justify-center"><Icon name="info" /></button>} />
      <div className="mx-5 mt-2 rounded-[24px] px-6 pt-7 pb-6 text-white relative overflow-hidden" style={{ background: FELT }}>
        <div className="absolute right-5 top-6 w-[96px] h-[80px]" aria-hidden="true">
          <div className="absolute left-0 top-1 -rotate-[10deg]"><CardFace card={{ r: 3, s: 'coeur' }} w={50} /></div>
          <div className="absolute left-9 top-0 rotate-[8deg]"><CardFace card={{ r: 10, s: 'trefle' }} w={50} /></div>
        </div>
        <div className="text-[13px] font-semibold" style={{ color: C.ochre }}>Fap Fap</div>
        <h1 className="serif text-[34px] font-semibold leading-[1.05] mt-1 max-w-[200px]">Le Jambo n'aime pas la panique.</h1>
        <p className="text-[14px] leading-relaxed mt-3 max-w-[260px]" style={{ color: 'rgba(255,255,255,.75)' }}>Gagne le dernier pli, ou annonce ta main dès le premier tour.</p>
        {stats.played > 0 && <div className="text-[13px] mt-4" style={{ color: 'rgba(255,255,255,.6)' }}>Parties gagnées sur ce téléphone : {stats.won} sur {stats.played}</div>}
      </div>
      <div className="px-5 pt-6 flex flex-col gap-5">
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>Adversaires</div>
          <Chips options={[{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }]} value={bots} onChange={setBots} />
        </div>
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>Partie en</div>
          <Chips options={[{ id: '5', label: '5 points' }, { id: '10', label: '10 points' }, { id: '15', label: '15 points' }]} value={target} onChange={setTarget} />
        </div>
        <Note>{guest ? "Gratuit et sans compte. On joue pour des points, jamais pour de l'argent." : "On joue pour des points, jamais pour de l'argent. Bientôt : défier tes proches en ligne."}</Note>
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        <Button onClick={() => onStart(Number(bots), Number(target))}>Distribuer</Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText())}`} target="_blank" rel="noopener noreferrer"
          className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-semibold" style={{ background: C.card, color: C.ink }}>
          <Icon name="chat" size={20} /> Inviter quelqu'un à jouer
        </a>
        <Button variant="ghost" onClick={() => setRules(true)}>Revoir les règles</Button>
        {guest && <div className="text-[12px] text-center" style={{ color: C.mute }}>Une app CKLabs</div>}
      </div>
      <RulesSheet open={rules} onClose={() => setRules(false)} />
    </Screen>
  );
};

// ---------- Table

export const JamboTable: React.FC<{ initial: Game; onQuit: () => void; onReplay: () => void }> = ({ initial, onQuit, onReplay }) => {
  const [g, setG] = useState<Game>(initial);
  const [rules, setRules] = useState(false);
  const [quit, setQuit] = useState(false);
  const [lastTrick, setLastTrick] = useState<string | null>(null);
  const counted = useRef(false);
  const n = g.players.length;
  const me = g.players[0];

  // Tours de l'ordinateur et ramassage des plis, avec un rythme lisible
  useEffect(() => {
    if (g.result) return;
    if (g.turn === null) {
      const best = currentBest(g.trick);
      if (best) setLastTrick(best.p === 0 ? 'Tu remportes le pli' : `${g.players[best.p].name} remporte le pli`);
      const t = setTimeout(() => { setG(x => resolveTrick(x)); setLastTrick(null); }, 1300);
      return () => clearTimeout(t);
    }
    if (!g.players[g.turn].human) {
      const t = setTimeout(() => setG(x => {
        if (x.turn === null || x.result || x.players[x.turn].human) return x;
        const m = aiMove(x, x.turn);
        return 'claim' in m ? claim(x, x.turn) : play(x, x.turn, m.card);
      }), g.trick.length ? 750 : 950);
      return () => clearTimeout(t);
    }
  }, [g]);

  useEffect(() => {
    if (g.matchWinner !== null && !counted.current) { counted.current = true; saveStats(g.matchWinner === 0); }
  }, [g.matchWinner]);

  const myTurn = g.turn === 0 && !g.result;
  const legal = myTurn ? legalCards(me.hand, g.trick) : [];
  const myClaim = canClaim(g, 0);
  const best = currentBest(g.trick);
  const led = g.trick[0]?.c.s;
  const status = g.result ? '' : lastTrick ? lastTrick
    : myTurn ? (led && me.hand.some(c => c.s === led) ? `À toi : fournis du ${SUIT_NAME[led]}` : g.trick.length ? 'À toi : tu n’as pas la famille, jette une carte' : g.trickNo === 5 ? 'À toi : dernier pli, tu commandes' : 'À toi de commander')
    : g.turn !== null ? `${g.players[g.turn].name} réfléchit…` : '';

  const cardW = Math.min(70, Math.floor((Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, 480) - 40 - 4 * 8) / 5));
  const opp = g.players.slice(1);

  const r = g.result;
  const resultText = r && (r.kind === 'claim'
    ? `Annonce : ${CLAIM_LABEL[r.claim!].toLowerCase()}.`
    : r.kind === 'kora' ? `Kora ! Dernier pli remporté avec le ${cardName(r.card!)}.`
    : r.kind === 'doubleKora' ? 'Double Kora ! Les deux derniers plis remportés avec des 3.'
    : `Dernier pli remporté avec le ${cardName(r.card!)}.`);

  return (
    <div className="min-h-[100dvh] w-full flex justify-center text-white" style={{ background: `radial-gradient(120% 80% at 50% 40%, #233067 0%, ${FELT} 60%, #0F1735 100%)` }}>
      <div className="w-full max-w-[480px] flex flex-col min-h-[100dvh]">
        {/* Barre du haut */}
        <div className="flex items-center gap-1 px-3 pt-[max(env(safe-area-inset-top),16px)] min-h-[56px]">
          <button onClick={() => setQuit(true)} aria-label="Quitter" className="w-11 h-11 flex items-center justify-center rounded-full active:bg-white/10"><Icon name="close" /></button>
          <div className="flex-1 text-center text-[14px] font-semibold" style={{ color: 'rgba(255,255,255,.8)' }}>Manche {g.round} · pli {Math.min(g.trickNo, 5)} sur 5</div>
          <button onClick={() => setRules(true)} aria-label="Règles" className="w-11 h-11 flex items-center justify-center rounded-full active:bg-white/10"><Icon name="info" /></button>
        </div>

        {/* Scores */}
        <div className="px-4 flex gap-2 overflow-x-auto">
          {g.players.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-semibold shrink-0"
              style={{ background: g.turn === i ? C.ochre : 'rgba(255,255,255,.1)', color: g.turn === i ? C.ink : '#fff' }}>
              {i === 0 ? 'Toi' : p.name}<span className="tabular-nums font-bold">{p.score}</span>
            </div>
          ))}
          <div className="h-8 px-2 flex items-center text-[12px] shrink-0" style={{ color: 'rgba(255,255,255,.55)' }}>sur {g.target}</div>
        </div>

        {/* Adversaires */}
        <div className={`px-4 pt-5 grid gap-2 ${opp.length === 1 ? 'grid-cols-1' : opp.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {opp.map((p, k) => {
            const i = k + 1;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {g.leader === i && !g.result && <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: C.ochre, color: C.ink }} title="Commandant">C</span>}
                  {p.name}
                </div>
                <div className="flex -space-x-2.5">{p.hand.map((_, j) => <CardBack key={j} />)}</div>
              </div>
            );
          })}
        </div>

        {/* Pli en cours */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 min-h-[190px]">
          <div className="flex flex-wrap justify-center gap-3">
            {g.trick.map(t => (
              <div key={`${t.p}-${t.c.r}${t.c.s}`} className="flex flex-col items-center gap-1.5 animate-[fadeUp_.25s_ease-out]">
                <CardFace card={t.c} w={60} glow={best?.p === t.p && g.trick.length > 1} />
                <span className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,.75)' }}>{t.p === 0 ? 'Toi' : g.players[t.p].name}</span>
              </div>
            ))}
            {!g.trick.length && !g.result && (
              <div className="text-[13px] text-center max-w-[220px]" style={{ color: 'rgba(255,255,255,.5)' }}>
                {g.leader === 0 ? 'Tu commandes ce pli : choisis la famille avec ta carte.' : `${g.players[g.leader].name} commande ce pli.`}
              </div>
            )}
          </div>
          <div className="h-6 mt-4 text-[14px] font-semibold text-center" role="status" style={{ color: lastTrick ? C.ochre : 'rgba(255,255,255,.85)' }}>{status}</div>
        </div>

        {/* Annonce possible */}
        {myClaim && (
          <div className="px-4 pb-3">
            <button onClick={() => setG(x => claim(x, 0))} className="w-full h-12 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2" style={{ background: C.ochre, color: C.ink }}>
              Annoncer : {CLAIM_LABEL[myClaim].toLowerCase()}
            </button>
          </div>
        )}

        {/* Ma main */}
        <div className="px-4 pt-3 pb-[max(env(safe-area-inset-bottom),20px)]" style={{ background: 'rgba(0,0,0,.18)' }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold">
              {g.leader === 0 && !g.result && <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: C.ochre, color: C.ink }}>C</span>}
              Ta main
            </div>
            <div className="text-[12px]" style={{ color: 'rgba(255,255,255,.55)' }}>Somme : {me.hand.reduce((a, c) => a + c.r, 0)}</div>
          </div>
          <div className="flex justify-center gap-2 min-h-[100px] pt-2.5">
            {me.hand.slice().sort((a, b) => a.s.localeCompare(b.s) || a.r - b.r).map(card => {
              const ok = legal.some(sameCard(card));
              return (
                <button key={`${card.r}${card.s}`} disabled={!ok} onClick={() => setG(x => play(x, 0, card))} aria-label={`Jouer le ${cardName(card)}`}>
                  <CardFace card={card} w={cardW} dim={myTurn && !ok} lift={myTurn && ok} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fin de manche (les panneaux reprennent l'encre : la table est en blanc sur fond sombre) */}
      <div style={{ color: C.ink }}>
      <Sheet open={!!r} onClose={() => undefined} title={g.matchWinner !== null
        ? (g.matchWinner === 0 ? 'Tu remportes la partie' : `${g.players[g.matchWinner].name} remporte la partie`)
        : r?.winner === 0 ? 'Tu gagnes la manche' : `${r ? g.players[r.winner].name : ''} gagne la manche`}>
        {r && (
          <div className="flex flex-col gap-4" style={{ color: C.ink }}>
            <p className="text-[15px]" style={{ color: C.text2 }}>{resultText} <b>+{r.points} point{r.points > 1 ? 's' : ''}</b></p>
            {r.hand && <div className="flex gap-1.5">{r.hand.map(c => <CardFace key={`${c.r}${c.s}`} card={c} w={48} />)}</div>}
            <div className="rounded-2xl bg-white">
              {g.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score).map(({ p, i }, k) => (
                <div key={i} className="flex justify-between px-4 py-3 text-[15px]" style={{ borderTop: k ? `1px solid ${C.line}` : undefined }}>
                  <span className="font-semibold">{i === 0 ? 'Toi' : p.name}</span>
                  <span className="font-bold tabular-nums">{p.score} pt{p.score > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
            {g.matchWinner !== null ? (
              <div className="flex flex-col gap-2.5">
                <Button onClick={onReplay}>Rejouer</Button>
                <Button variant="secondary" onClick={onQuit}>Quitter la table</Button>
              </div>
            ) : <Button onClick={() => setG(x => nextRound(x))}>Manche suivante</Button>}
          </div>
        )}
      </Sheet>
      <Sheet open={quit} onClose={() => setQuit(false)} title="Quitter la partie ?">
        <p className="text-[15px] mb-4" style={{ color: C.text2 }}>La partie en cours sera perdue.</p>
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

const Jambo: React.FC<{ playerName: string; onBack?: () => void; guest?: boolean }> = ({ playerName, onBack, guest }) => {
  const [game, setGame] = useState<{ g: Game; key: number; bots: number; target: number } | null>(null);
  const start = (bots: number, target: number) => {
    const names = [{ name: firstName(playerName) || 'Toi', human: true }, ...BOTS.slice(0, bots).map(name => ({ name, human: false }))];
    setGame({ g: newGame(names, target), key: Date.now(), bots, target });
    window.scrollTo(0, 0);
  };
  if (!game) return <Setup onStart={start} onBack={onBack} guest={guest} />;
  return <JamboTable key={game.key} initial={game.g} onQuit={() => setGame(null)} onReplay={() => start(game.bots, game.target)} />;
};

export default Jambo;
