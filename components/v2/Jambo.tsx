import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Screen, TopBar, Button, Chips, Note, Icon, C, firstName } from './ui';
import { Game, Card, newGame, nextRound, play, claim, resolveTrick, aiMove, currentBest } from '../../games/fapfap';
import { CardFace, RulesSheet, TableView, TableModel, FELT, readStats, saveStats } from './JamboTable';

// Jambo (Fap Fap) : contre l'ordinateur, ou en ligne entre amis. Des points, jamais d'argent.

const BOTS = ['Tonton', 'La Go', 'Le Boss'];
// Le jeu en ligne (et Firebase) n'est chargé que si l'on choisit de jouer avec des amis.
const JamboOnline = lazy(() => import('./JamboOnline'));

const shareText = () => `Viens jouer au Fap Fap contre l'ordinateur. Gratuit, sans compte, on joue pour des points : ${window.location.origin}/jambo`;

const Setup: React.FC<{ onStart: (bots: number, target: number) => void; onOnline: (target: number) => void; onBack?: () => void; guest?: boolean }> = ({ onStart, onOnline, onBack, guest }) => {
  const [mode, setMode] = useState<'ordi' | 'amis'>('amis');
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
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl" style={{ background: C.soft }} role="tablist">
          {([['amis', 'Avec des amis'], ['ordi', "Contre l'ordinateur"]] as const).map(([id, l]) => (
            <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className="h-11 rounded-xl text-[14px] font-bold"
              style={{ background: mode === id ? C.card : 'transparent', color: mode === id ? C.ink : C.mute, boxShadow: mode === id ? '0 1px 3px rgba(0,0,0,.08)' : undefined }}>{l}</button>
          ))}
        </div>
        {mode === 'ordi' && (
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>Adversaires</div>
          <Chips options={[{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }]} value={bots} onChange={setBots} />
        </div>
        )}
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>Partie en</div>
          <Chips options={[{ id: '5', label: '5 points' }, { id: '10', label: '10 points' }, { id: '15', label: '15 points' }]} value={target} onChange={setTarget} />
        </div>
        <Note>{mode === 'amis'
          ? "Tu crées une table et tu envoies le lien sur WhatsApp. Tes amis entrent leur prénom et s'assoient, sans compte. On joue pour des points, jamais pour de l'argent."
          : guest ? "Gratuit et sans compte. On joue pour des points, jamais pour de l'argent." : "On joue pour des points, jamais pour de l'argent."}</Note>
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        {mode === 'amis'
          ? <Button onClick={() => onOnline(Number(target))}>Créer une table</Button>
          : <>
            <Button onClick={() => onStart(Number(bots), Number(target))}>Distribuer</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText())}`} target="_blank" rel="noopener noreferrer"
              className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-semibold" style={{ background: C.card, color: C.ink }}>
              <Icon name="chat" size={20} /> Inviter quelqu'un à jouer
            </a>
          </>}
        <Button variant="ghost" onClick={() => setRules(true)}>Revoir les règles</Button>
        {guest && <div className="text-[12px] text-center" style={{ color: C.mute }}>Une app CKLabs</div>}
      </div>
      <RulesSheet open={rules} onClose={() => setRules(false)} />
    </Screen>
  );
};

// ---------- Partie contre l'ordinateur

export const JamboTable: React.FC<{ initial: Game; onQuit: () => void; onReplay: () => void }> = ({ initial, onQuit, onReplay }) => {
  const [g, setG] = useState<Game>(initial);
  const [banner, setBanner] = useState<string | null>(null);
  const counted = useRef(false);

  // Tours de l'ordinateur et ramassage des plis, avec un rythme lisible
  useEffect(() => {
    if (g.result) return;
    if (g.turn === null) {
      const best = currentBest(g.trick);
      if (best) setBanner(best.p === 0 ? 'Tu remportes le pli' : `${g.players[best.p].name} remporte le pli`);
      const t = setTimeout(() => { setG(x => resolveTrick(x)); setBanner(null); }, 1300);
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

  const m: TableModel = {
    names: g.players.map(p => p.name), bots: g.players.map(p => !p.human), scores: g.players.map(p => p.score),
    counts: g.players.map(p => p.hand.length), myHand: g.players[0].hand, target: g.target, round: g.round, trickNo: g.trickNo,
    leader: g.leader, turn: g.turn, trick: g.trick, result: g.result, matchWinner: g.matchWinner,
  };
  return (
    <TableView m={m} banner={banner} locked={g.turn === null} showResult
      onPlay={(c: Card) => setG(x => (x.turn === 0 ? play(x, 0, c) : x))} onClaim={() => setG(x => claim(x, 0))}
      onNext={() => setG(x => nextRound(x))} onReplay={onReplay} onQuit={onQuit}
      quitTitle="Quitter la partie ?" quitText="La partie en cours sera perdue." />
  );
};

const Jambo: React.FC<{ playerName: string; onBack?: () => void; guest?: boolean; tableCode?: string }> = ({ playerName, onBack, guest, tableCode }) => {
  const [game, setGame] = useState<{ g: Game; key: number; bots: number; target: number } | null>(null);
  const [online, setOnline] = useState<{ code?: string; target?: number } | null>(tableCode ? { code: tableCode } : null);
  const start = (bots: number, target: number) => {
    const names = [{ name: firstName(playerName) || 'Toi', human: true }, ...BOTS.slice(0, bots).map(name => ({ name, human: false }))];
    setGame({ g: newGame(names, target), key: Date.now(), bots, target });
    window.scrollTo(0, 0);
  };
  if (online) return (
    <Suspense fallback={<div className="min-h-[100dvh]" style={{ background: FELT }} />}>
      <JamboOnline code={online.code} target={online.target} defaultName={firstName(playerName)} guest={guest} onExit={() => setOnline(null)} />
    </Suspense>
  );
  if (!game) return <Setup onStart={start} onOnline={target => setOnline({ target })} onBack={onBack} guest={guest} />;
  return <JamboTable key={game.key} initial={game.g} onQuit={() => setGame(null)} onReplay={() => start(game.bots, game.target)} />;
};

export default Jambo;
