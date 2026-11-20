import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Screen, TopBar, Toast, Icon, C } from './ui';
import { FELT } from './JamboTable';
import { MAX_TRIES, Mark, dayNumber, untilNext, puzzleFor, evaluate, keyMarks, isWon, isOver, norm, shareText, stats, History, EXTRA_WORDS } from '../../games/mot';

// « Le mot du jour » : un mot par jour, le même pour tous, 6 essais. Pas de compte de points entre
// amis ni de classement : on partage sa grille de couleurs sur WhatsApp, sans dévoiler le mot.
// Les essais restent sur le téléphone (une partie par jour et par appareil).

const KEY = 'ck_mot';
const LINK = 'https://ck-money.vercel.app/?mot';
const CAT_LABEL: Record<string, string> = { plat: 'un plat', camfranglais: 'du camfranglais', ville: 'une ville', musique: 'une musique', foot: 'une figure du foot', 'vie courante': 'la vie de tous les jours' };

const loadHistory = (): History => { try { return JSON.parse(localStorage.getItem(KEY) || '{}').h || {}; } catch { return {}; } };
const saveHistory = (h: History) => { try { localStorage.setItem(KEY, JSON.stringify({ h })); } catch { /* stockage indisponible */ } };

// Dictionnaire des essais acceptés, chargé à la demande pour la longueur du jour
const dicts = new Map<number, Promise<Set<string> | null>>();
const loadDict = (len: number) => {
  if (!dicts.has(len)) dicts.set(len, fetch(`/mots/fr${len}.txt?v=1`).then(r => (r.ok ? r.text() : Promise.reject())).then(t => new Set(t.split('\n'))).catch(() => null));
  return dicts.get(len)!;
};

const COLORS: Record<Mark, { bg: string; fg: string }> = {
  ok: { bg: C.green, fg: '#fff' },
  near: { bg: C.ochre, fg: '#fff' },
  no: { bg: '#8A8E9C', fg: '#fff' },
};

const Tile: React.FC<{ ch?: string; mark?: Mark; active?: boolean; size: number }> = ({ ch, mark, active, size }) => (
  <div className="flex items-center justify-center rounded-[10px] font-bold uppercase select-none transition-colors"
    style={{
      width: size, height: size, fontSize: size * 0.48,
      background: mark ? COLORS[mark].bg : C.card, color: mark ? COLORS[mark].fg : C.ink,
      border: mark ? 'none' : `2px solid ${ch ? C.ink : active ? C.border : C.line}`,
    }}>{ch || ''}</div>
);

const ROWS = ['AZERTYUIOP', 'QSDFGHJKLM', '+WXCVBN-'];

const Keyboard: React.FC<{ marks: Record<string, Mark>; onKey: (k: string) => void; disabled: boolean }> = ({ marks, onKey, disabled }) => (
  <div className="px-1.5 flex flex-col gap-1.5 select-none">
    {ROWS.map(r => (
      <div key={r} className="flex gap-1 justify-center">
        {r.split('').map(k => {
          const special = k === '+' || k === '-';
          const m = marks[k];
          return (
            <button key={k} disabled={disabled} onClick={() => onKey(k === '+' ? 'Enter' : k === '-' ? 'Backspace' : k)}
              aria-label={k === '+' ? 'Valider' : k === '-' ? 'Effacer' : k}
              className={`h-[52px] rounded-lg font-bold flex items-center justify-center active:opacity-70 disabled:opacity-60 ${special ? 'flex-[1.6] text-[12px]' : 'flex-1 text-[16px]'}`}
              style={{ background: m ? COLORS[m].bg : special ? C.ink : '#DCDDE3', color: m || special ? '#fff' : C.ink, minWidth: 0 }}>
              {k === '+' ? 'OK' : k === '-' ? '⌫' : k}
            </button>
          );
        })}
      </div>
    ))}
  </div>
);

const hms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
};

const Mot: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [today, setToday] = useState(() => dayNumber());
  const puzzle = useMemo(() => puzzleFor(today), [today]);
  const len = puzzle.word.length;
  const [history, setHistory] = useState<History>(loadHistory);
  const guesses = history[today] || [];
  const [cur, setCur] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [now, setNow] = useState(Date.now());
  const over = isOver(guesses, puzzle.word);
  const won = isWon(guesses, puzzle.word);

  useEffect(() => { loadDict(len); }, [len]);
  useEffect(() => {
    const k = setInterval(() => { setNow(Date.now()); const d = dayNumber(); if (d !== today) { setToday(d); setCur(''); } }, 20_000);
    return () => clearInterval(k);
  }, [today]);

  const bump = (msg: string) => { setToast(msg); setShake(true); setTimeout(() => setShake(false), 400); };

  const submit = useCallback(async () => {
    if (cur.length < len) return bump(`Il faut ${len} lettres.`);
    const dict = await loadDict(len);
    if (dict && !dict.has(cur) && !EXTRA_WORDS.has(cur)) return bump('Ce mot n’est pas dans notre dictionnaire.');
    const next = { ...history, [today]: [...guesses, cur] };
    setHistory(next); saveHistory(next); setCur('');
    if (norm(cur) === puzzle.word) setToast(['Génie !', 'Magnifique !', 'Bravo !', 'Bien joué !', 'Ouf !', 'De justesse !'][guesses.length] || 'Bravo !');
  }, [cur, len, history, today, guesses, puzzle.word]);

  const onKey = useCallback((k: string) => {
    if (over) return;
    if (k === 'Enter') { submit(); return; }
    if (k === 'Backspace') { setCur(c => c.slice(0, -1)); return; }
    const l = norm(k);
    if (l.length === 1) setCur(c => (c.length < len ? c + l : c));
  }, [over, submit, len]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-zA-ZÀ-ÿ]$/.test(e.key)) { e.preventDefault(); onKey(e.key); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onKey]);

  const marks = useMemo(() => keyMarks(guesses, puzzle.word), [guesses, puzzle.word]);
  const st = useMemo(() => stats(history, today), [history, today]);
  const size = Math.min(56, Math.floor((Math.min(window.innerWidth, 480) - 48 - (len - 1) * 6) / len));
  const share = shareText(puzzle, guesses, LINK);

  return (
    <Screen>
      <TopBar onBack={onBack} title="Le mot du jour" right={st.streak > 0 ? <span className="pr-3 text-[13px] font-bold" style={{ color: C.ochreText }}>🔥 {st.streak}</span> : undefined} />
      <div className="mx-5 mt-1 rounded-[20px] px-5 py-4 text-white" style={{ background: FELT }}>
        <div className="text-[12.5px] font-semibold" style={{ color: C.ochre }}>N° {puzzle.n} · {len} lettres</div>
        <div className="text-[14px] leading-snug mt-1" style={{ color: 'rgba(255,255,255,.85)' }}>
          {puzzle.local ? <>Aujourd’hui, un <b>mot du 237</b> : {CAT_LABEL[puzzle.local.cat]}.</> : 'Un mot français. Les accents ne comptent pas.'}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 pt-5 pb-4">
        {Array.from({ length: MAX_TRIES }, (_, r) => {
          const g = guesses[r];
          const isCur = !g && r === guesses.length && !over;
          const text = g ? norm(g) : isCur ? cur : '';
          const m = g ? evaluate(g, puzzle.word) : [];
          return (
            <div key={r} className="flex gap-1.5" style={isCur && shake ? { animation: 'motShake .35s' } : undefined}>
              {Array.from({ length: len }, (_, i) => <Tile key={i} ch={text[i]} mark={m[i]} active={isCur} size={size} />)}
            </div>
          );
        })}
      </div>

      {over ? (
        <div className="px-5 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-3">
          <div className="rounded-2xl p-4" style={{ background: C.card }}>
            <div className="text-[13px] font-semibold" style={{ color: won ? C.green : C.red }}>{won ? `Trouvé en ${guesses.length} essai${guesses.length > 1 ? 's' : ''}` : 'Pas cette fois'}</div>
            <div className="serif text-[28px] font-semibold leading-tight mt-0.5">{puzzle.show}</div>
            {puzzle.local && <p className="text-[14px] leading-relaxed mt-1.5" style={{ color: C.text2 }}>{puzzle.local.def}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer"
              className="h-12 rounded-xl flex items-center justify-center gap-2 text-[14px] font-bold text-white" style={{ background: C.green }}>
              <Icon name="chat" size={18} /> Partager
            </a>
            <button onClick={() => { navigator.clipboard?.writeText(share).then(() => setToast('Grille copiée')).catch(() => undefined); }}
              className="h-12 rounded-xl flex items-center justify-center gap-2 text-[14px] font-bold" style={{ background: C.card, color: C.ink }}>
              <Icon name="copy" size={18} /> Copier
            </button>
          </div>
          <div className="rounded-2xl p-4" style={{ background: C.card }}>
            <div className="grid grid-cols-4 text-center">
              {[[st.played, 'joués'], [st.played ? Math.round((st.won / st.played) * 100) : 0, '% gagnés'], [st.streak, 'série'], [st.best, 'record']].map(([v, l]) => (
                <div key={l as string}><div className="text-[22px] font-bold">{v}</div><div className="text-[11.5px]" style={{ color: C.mute }}>{l}</div></div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-1">
              {st.dist.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="w-3 text-right font-semibold">{i + 1}</span>
                  <div className="h-5 rounded flex items-center justify-end px-1.5 text-white font-bold"
                    style={{ width: `${Math.max(8, (c / Math.max(1, ...st.dist)) * 100)}%`, background: won && guesses.length === i + 1 ? C.green : '#8A8E9C' }}>{c}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center text-[13.5px]" style={{ color: C.mute }}>Prochain mot dans <b style={{ color: C.ink }}>{hms(untilNext(now))}</b></div>
        </div>
      ) : (
        <div className="mt-auto pb-[max(env(safe-area-inset-bottom),12px)]">
          <Keyboard marks={marks} onKey={onKey} disabled={over} />
        </div>
      )}
      <style>{'@keyframes motShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}'}</style>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

export default Mot;
