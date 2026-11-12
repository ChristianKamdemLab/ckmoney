import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Screen, TopBar, Button, Chips, Note, Card as Box, Avatar, Toast, Icon, inputClass, inputStyle, C, firstName } from './ui';
import { Felt, NameStep, ShareBox } from './GameKit';
import { FELT } from './JamboTable';
import { ensurePlayer, savedName, saveName, ERRORS } from '../../services/jamboOnline';
import { bac, watchBac, bacLink, BacTable } from '../../services/bacOnline';
import { DEFAULT_CATEGORIES, MORE_CATEGORIES, startsWithLetter, rejectedByVote, POINTS_UNIQUE, POINTS_SHARED } from '../../games/bac';

// Le Baccalauréat (petit bac) en ligne : une lettre, des catégories, chacun écrit sur son téléphone.
// Sortir de l'appli pendant l'écriture se voit ; les réponses douteuses se tranchent au vote.

const errorText = (e: unknown) => ({ ...ERRORS, incomplet: 'Remplis toutes les catégories pour dire STOP.', categories: 'Il faut au moins 3 catégories.' } as Record<string, string>)[(e as Error)?.message] || 'Un souci de connexion. Réessaie.';
const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const nameOf = (t: BacTable, uid: string, me: string) => (uid === me ? 'Toi' : t.seats.find(s => s.uid === uid)?.name || '?');
const awayText = (a?: { n: number; secs: number; out: boolean }) =>
  !a || !a.n ? '' : a.out ? "hors de l'appli" : `a quitté l'appli ${a.n} fois${a.secs ? ` (${a.secs} s)` : ''}`;

const useNow = (ms = 500) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const k = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(k); }, [ms]);
  return now;
};

// ---------- Salle d'attente

const Lobby: React.FC<{ t: BacTable; uid: string; onLeave: () => void }> = ({ t, uid, onLeave }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const isHost = t.hostUid === uid;
  const host = t.seats.find(s => s.uid === t.hostUid);
  const config = async (patch: Record<string, unknown>, key = 'cfg') => {
    setBusy(key);
    try { await bac('config', { code: t.code, categories: t.categories, rounds: t.rounds, duration: t.duration, ...patch }); }
    catch (e) { setToast(errorText(e)); } finally { setBusy(null); }
  };
  const toggle = (c: string) => config({ categories: t.categories.includes(c) ? t.categories.filter(x => x !== c) : [...t.categories, c] });
  const all = [...new Set([...DEFAULT_CATEGORIES, ...MORE_CATEGORIES, ...t.categories])];
  return (
    <Screen>
      <TopBar onBack={onLeave} title="Baccalauréat" />
      <ShareBox code={t.code} link={bacLink(t.code)} text={`On fait un Baccalauréat ? Rejoins ma table ${t.code}, sans feuille ni stylo : ${bacLink(t.code)}`} onCopied={() => setToast('Lien copié')} />
      <div className="px-5 pt-6 pb-2 text-[15px] font-bold">Joueurs ({t.seats.length})</div>
      <div className="px-5">
        <Box>
          {t.seats.map((s, i) => (
            <div key={s.uid} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
              <Avatar name={s.name} size={36} tone={i} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold truncate">{s.name}</div>
                <div className="text-[12px]" style={{ color: C.mute }}>{[s.uid === uid ? 'toi' : '', s.uid === t.hostUid ? 'organise la partie' : ''].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </Box>
      </div>
      <div className="px-5 pt-6">
        <div className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>Catégories ({t.categories.length})</div>
        {isHost ? (
          <>
            <div className="flex flex-wrap gap-2">
              {all.map(c => {
                const on = t.categories.includes(c);
                return (
                  <button key={c} onClick={() => toggle(c)} disabled={!!busy} className="h-10 px-4 rounded-full text-[14px] font-semibold"
                    style={{ border: `1.5px solid ${on ? C.ink : C.border}`, background: on ? C.ink : C.card, color: on ? '#fff' : C.ink }}>{c}</button>
                );
              })}
            </div>
            <form className="flex gap-2 mt-3" onSubmit={e => { e.preventDefault(); if (custom.trim()) { config({ categories: [...t.categories, custom.trim()] }); setCustom(''); } }}>
              <input value={custom} onChange={e => setCustom(e.target.value)} maxLength={30} placeholder="Autre catégorie (ex. Plat camerounais)" className={inputClass} style={inputStyle} />
              <button type="submit" aria-label="Ajouter la catégorie" className="w-[52px] shrink-0 rounded-[14px] flex items-center justify-center" style={{ background: C.ink, color: '#fff' }}><Icon name="plus" /></button>
            </form>
          </>
        ) : <div className="text-[15px] leading-relaxed">{t.categories.join(' · ')}</div>}
      </div>
      <div className="px-5 pt-5 grid gap-5">
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>Manches</div>
          {isHost ? <Chips options={[{ id: '3', label: '3' }, { id: '5', label: '5' }, { id: '10', label: '10' }]} value={String(t.rounds)} onChange={v => config({ rounds: Number(v) })} />
            : <div className="text-[15px] font-semibold">{t.rounds}</div>}
        </div>
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>Temps maximum par manche</div>
          {isHost ? <Chips options={[{ id: '90', label: '1 min 30' }, { id: '120', label: '2 min' }, { id: '180', label: '3 min' }]} value={String(t.duration)} onChange={v => config({ duration: Number(v) })} />
            : <div className="text-[15px] font-semibold">{mmss(t.duration * 1000)}</div>}
        </div>
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        {isHost ? (
          <>
            {t.seats.length < 2 && <Note>En attente d'au moins un autre joueur.</Note>}
            <Button busy={busy === 'start'} disabled={t.seats.length < 2} onClick={async () => { setBusy('start'); try { await bac('start', { code: t.code }); } catch (e) { setToast(errorText(e)); } finally { setBusy(null); } }}>Lancer la partie</Button>
          </>
        ) : <Note>En attente : {host?.name || "l'organisateur"} lance la partie dès que tout le monde est là.</Note>}
        <Button variant="ghost" onClick={onLeave}>Quitter la table</Button>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

// ---------- Écriture

const Writing: React.FC<{ t: BacTable; uid: string; onExit: () => void }> = ({ t, uid, onExit }) => {
  const key = `bac_${t.code}_${t.round}`;
  const [answers, setAnswers] = useState<string[]>(() => {
    try { const s = JSON.parse(sessionStorage.getItem(key) || 'null'); if (Array.isArray(s)) return s; } catch { /* ignore */ }
    return t.categories.map(() => '');
  });
  const [toast, setToast] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const now = useNow(250);
  const saved = useRef<string>('');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const letter = t.letter || '?';
  const deadline = t.stopAt || t.endsAt || 0;
  const left = deadline - now;

  const save = async (list = answers) => {
    const s = JSON.stringify(list);
    if (s === saved.current) return;
    saved.current = s;
    await bac('save', { code: t.code, round: t.round, answers: list }).catch(() => { saved.current = ''; });
  };
  // Sauvegarde au fil de l'eau (et copie locale si la page se recharge)
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(answers)); } catch { /* ignore */ }
    const k = setTimeout(() => save(), 1200);
    return () => clearTimeout(k);
  }, [answers]);
  // Dernier envoi juste avant la fin
  useEffect(() => { if (left < 1500 && left > -1000) save(); }, [left < 1500]);
  // Fermer l'écriture quand le temps est passé (n'importe quel téléphone peut le demander)
  useEffect(() => {
    let alive = true, k: ReturnType<typeof setTimeout>;
    const go = (d: number) => { k = setTimeout(async () => { if (!alive) return; try { const r = await bac('close', { code: t.code }); if (alive && r?.wait) go(r.wait + 200); } catch { if (alive) go(2500); } }, Math.max(300, d) + Math.random() * 400); };
    go(deadline - Date.now() + 1700);
    return () => { alive = false; clearTimeout(k); };
  }, [deadline]);
  // Sortir de l'appli se voit
  useEffect(() => {
    let out = 0;
    const on = () => {
      if (document.visibilityState === 'hidden') { out = Date.now(); bac('away', { code: t.code, state: 'out' }, true).catch(() => undefined); }
      else if (out) { const secs = Math.round((Date.now() - out) / 1000); out = 0; bac('away', { code: t.code, state: 'back', secs }).catch(() => undefined); }
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const full = answers.every(a => a.trim());
  const stop = async () => {
    setStopping(true);
    try { saved.current = ''; await save(); await bac('stop', { code: t.code }); }
    catch (e) { setToast(errorText(e)); } finally { setStopping(false); }
  };
  const others = t.seats.filter(s => s.uid !== uid);
  const stopper = t.stoppedBy ? nameOf(t, t.stoppedBy, uid) : null;

  return (
    <Screen>
      <TopBar onBack={onExit} title={`Manche ${t.round} sur ${t.rounds}`} right={<div className="text-[15px] font-bold tabular-nums pr-2" style={{ color: left < 15000 ? C.red : C.ink }}>{mmss(left)}</div>} />
      <div className="mx-5 mt-1 rounded-[24px] px-6 py-5 text-white flex items-center gap-5" style={{ background: FELT }}>
        <div className="serif text-[72px] font-semibold leading-none w-[64px] text-center" style={{ color: C.ochre }}>{letter}</div>
        <div className="flex-1 text-[14px] leading-snug" style={{ color: 'rgba(255,255,255,.8)' }}>
          {stopper ? <b className="text-white">{stopper === 'Toi' ? 'Tu as dit STOP' : `${stopper} a dit STOP`} : plus que {Math.max(0, Math.ceil(left / 1000))} s !</b>
            : <>Un mot par catégorie, commençant par <b className="text-white">{letter}</b>. Tes réponses restent cachées jusqu'à la fin.</>}
        </div>
      </div>
      {others.length > 0 && (
        <div className="px-5 pt-3 flex flex-wrap gap-1.5">
          {others.map(s => {
            const a = t.away?.[s.uid];
            return (
              <div key={s.uid} className="h-7 px-2.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5"
                style={{ background: a?.n ? C.redSoft : C.soft, color: a?.n ? '#8C1D18' : C.text2 }}>
                {s.name} {t.filled?.[s.uid] || 0}/{t.categories.length}{a?.n ? ` · ${awayText(a)}` : ''}
              </div>
            );
          })}
        </div>
      )}
      <div className="px-5 pt-4 flex flex-col gap-3 pb-4">
        {t.categories.map((cat, i) => {
          const v = answers[i] || '';
          const bad = !!v.trim() && !startsWithLetter(v, letter);
          return (
            <label key={i} className="block">
              <div className="text-[13px] font-semibold mb-1" style={{ color: C.text2 }}>{cat}</div>
              <input ref={el => { inputs.current[i] = el; }} value={v} maxLength={40} placeholder={`${letter}…`}
                autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="words" enterKeyHint={i < t.categories.length - 1 ? 'next' : 'done'}
                onChange={e => { const n = answers.slice(); n[i] = e.target.value; setAnswers(n); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); inputs.current[i + 1]?.focus(); } }}
                onBlur={() => save()} disabled={left <= 0}
                className={inputClass} style={{ ...inputStyle, borderColor: bad ? C.red : v.trim() ? C.green : C.border }} />
              {bad && <div className="text-[12px] mt-1" style={{ color: C.red }}>Ne commence pas par {letter}</div>}
            </label>
          );
        })}
      </div>
      <div className="sticky bottom-0 mt-auto px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]" style={{ background: C.bg }}>
        <button onClick={stop} disabled={!full || !!t.stopAt || stopping || left <= 0}
          className="w-full h-14 rounded-2xl text-[17px] font-extrabold tracking-wide disabled:opacity-40" style={{ background: C.ochre, color: C.ink }}>
          {t.stopAt ? 'STOP annoncé' : full ? 'STOP !' : `STOP (${answers.filter(a => a.trim()).length}/${t.categories.length})`}
        </button>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

// ---------- Correction

const Review: React.FC<{ t: BacTable; uid: string; onExit: () => void }> = ({ t, uid, onExit }) => {
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const n = t.seats.length;
  const act = async (k: string, action: string, body: Record<string, unknown> = {}) => {
    setBusy(k);
    try { await bac(action, { code: t.code, ...body }); } catch (e) { setToast(errorText(e)); } finally { setBusy(null); }
  };
  const iAmReady = (t.ready || []).includes(uid);
  const aways = t.seats.filter(s => t.away?.[s.uid]?.n);
  return (
    <Screen>
      <TopBar onBack={onExit} title={`Correction · lettre ${t.letter}`} />
      <div className="px-5 pt-1 flex flex-col gap-2.5">
        <Note>Touche « Contester » pour refuser une réponse (mot inventé, mauvaise catégorie). Elle compte pour 0 si plus de la moitié des autres joueurs la contestent.</Note>
        {aways.length > 0 && <Note tone="warn">{aways.map(s => `${s.uid === uid ? 'Tu as' : `${s.name} a`} quitté l'appli ${t.away![s.uid].n} fois${t.away![s.uid].secs ? ` (${t.away![s.uid].secs} s)` : ''}`).join(' · ')} pendant la manche.</Note>}
      </div>
      <div className="px-5 pt-4 flex flex-col gap-3 pb-4">
        {(t.review || []).map((r, c) => (
          <Box key={c}>
            <div className="px-4 pt-3 pb-1 text-[13px] font-bold" style={{ color: C.ochreText }}>{r.cat}</div>
            {r.answers.map((a, i) => {
              const k = `${c}|${a.uid}`;
              const votes = (t.votes?.[k] || []).filter(v => v !== a.uid);
              const mine = votes.includes(uid);
              const out = rejectedByVote(votes.length, n);
              return (
                <div key={a.uid} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                  <div className="w-16 shrink-0 text-[13px] font-semibold truncate" style={{ color: C.mute }}>{nameOf(t, a.uid, uid)}</div>
                  <div className={`flex-1 min-w-0 text-[16px] font-semibold truncate ${out || a.auto ? 'line-through' : ''}`} style={{ color: a.auto || out ? C.mute : C.ink }}>{a.text || '—'}</div>
                  {a.auto ? <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: C.soft, color: C.mute }}>{a.auto === 'vide' ? 'vide' : `pas un ${t.letter}`}</span>
                    : a.uid === uid ? (votes.length ? <span className="text-[12px] font-semibold" style={{ color: out ? C.red : C.ochreText }}>contestée {votes.length}</span> : null)
                    : (
                      <button onClick={() => act(k, 'vote', { cat: c, target: a.uid, on: !mine })} disabled={busy === k}
                        className="h-8 px-3 rounded-full text-[12px] font-bold shrink-0"
                        style={{ background: mine ? C.red : C.soft, color: mine ? '#fff' : C.text2 }}>
                        {mine ? `Contestée${votes.length > 1 ? ` (${votes.length})` : ''}` : `Contester${votes.length ? ` (${votes.length})` : ''}`}
                      </button>
                    )}
                </div>
              );
            })}
          </Box>
        ))}
      </div>
      <div className="sticky bottom-0 mt-auto px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] flex flex-col gap-2" style={{ background: C.bg }}>
        <Button busy={busy === 'ready'} disabled={iAmReady} onClick={() => act('ready', 'ready')}>
          {iAmReady ? `En attente des autres (${(t.ready || []).length}/${n})` : `J'ai fini de corriger (${(t.ready || []).length}/${n})`}
        </Button>
        {t.hostUid === uid && <Button variant="ghost" busy={busy === 'score'} onClick={() => act('score', 'score')}>Compter les points maintenant</Button>}
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

// ---------- Scores

const Scores: React.FC<{ t: BacTable; uid: string; onExit: () => void }> = ({ t, uid, onExit }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const last = t.round >= t.rounds;
  const ranking = t.seats.slice().sort((a, b) => (t.scores?.[b.uid] || 0) - (t.scores?.[a.uid] || 0));
  const top = ranking[0];
  const act = async (action: string) => { setBusy(true); try { await bac(action, { code: t.code, version: t.version }); } catch { /* l'écran suivra */ } finally { setBusy(false); } };
  return (
    <Screen>
      <TopBar onBack={onExit} title={`Manche ${t.round} sur ${t.rounds}`} />
      <Felt>
        <div className="text-[13px] font-semibold" style={{ color: C.ochre }}>{last ? 'Partie terminée' : `Lettre ${t.letter}`}</div>
        <h1 className="serif text-[28px] font-semibold leading-tight mt-1">
          {last ? (top.uid === uid ? 'Tu remportes la partie' : `${top.name} remporte la partie`) : 'Les points de la manche'}
        </h1>
      </Felt>
      <div className="px-5 pt-5">
        <Box>
          {ranking.map((s, i) => (
            <div key={s.uid} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
              <div className="w-6 text-[15px] font-bold" style={{ color: i === 0 ? C.ochre : C.mute }}>{i + 1}</div>
              <div className="flex-1 text-[15px] font-semibold">{s.uid === uid ? 'Toi' : s.name}</div>
              <div className="text-[13px] font-semibold" style={{ color: C.green }}>+{t.roundPoints?.[s.uid] || 0}</div>
              <div className="w-14 text-right text-[16px] font-bold tabular-nums">{t.scores?.[s.uid] || 0}</div>
            </div>
          ))}
        </Box>
      </div>
      <div className="px-5 pt-3">
        <button onClick={() => setOpen(!open)} className="text-[14px] font-semibold flex items-center gap-1" style={{ color: C.ochreText }}>
          {open ? 'Masquer le détail' : 'Voir le détail des réponses'}
        </button>
        {open && (
          <div className="flex flex-col gap-2.5 pt-3">
            {(t.review || []).map((r, c) => (
              <Box key={c} className="px-4 py-3">
                <div className="text-[13px] font-bold mb-1.5" style={{ color: C.ochreText }}>{r.cat}</div>
                {r.answers.map(a => {
                  const pts = t.detail?.[`${c}|${a.uid}`] || 0;
                  return (
                    <div key={a.uid} className="flex items-center gap-2 py-1 text-[14px]">
                      <span className="w-16 truncate" style={{ color: C.mute }}>{nameOf(t, a.uid, uid)}</span>
                      <span className="flex-1 truncate font-semibold" style={{ color: pts ? C.ink : C.mute, textDecoration: pts ? undefined : 'line-through' }}>{a.text || '—'}</span>
                      <span className="w-8 text-right font-bold tabular-nums" style={{ color: pts === POINTS_UNIQUE ? C.green : pts === POINTS_SHARED ? C.ochreText : C.mute }}>{pts}</span>
                    </div>
                  );
                })}
              </Box>
            ))}
          </div>
        )}
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        {last ? (
          <>
            <Button busy={busy} onClick={() => act('rematch')}>Rejouer avec la même table</Button>
            <Button variant="secondary" onClick={onExit}>Quitter</Button>
          </>
        ) : <Button busy={busy} onClick={() => act('next')}>Manche suivante</Button>}
      </div>
    </Screen>
  );
};

// ---------- Entrée

const Bac: React.FC<{ playerName: string; onBack?: () => void; guest?: boolean; tableCode?: string }> = ({ playerName, onBack, guest, tableCode }) => {
  const [uid, setUid] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [code, setCode] = useState<string | null>(tableCode || null);
  const [table, setTable] = useState<BacTable | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = savedName() || firstName(playerName) || accountName;

  useEffect(() => {
    ensurePlayer()
      .then(u => { setUid(u.uid); if (!u.isAnonymous && u.displayName) setAccountName(firstName(u.displayName)); })
      .catch(() => setError('Connexion impossible. Vérifie ta connexion internet.'));
  }, []);
  useEffect(() => (code && uid ? watchBac(code, setTable) : undefined), [code, uid]);
  useEffect(() => {
    if (!guest) return;
    try { window.history.replaceState({}, '', code ? `/bac?t=${code}` : '/bac'); } catch { /* ignore */ }
  }, [code, guest]);

  const exit = () => { setCode(null); setTable(undefined); if (onBack) onBack(); };
  const leave = async () => { if (code) await bac('leave', { code }).catch(() => undefined); exit(); };
  const go = async (action: 'create' | 'join', n: string) => {
    setBusy(true); setError(null); saveName(n);
    try { const r = await bac(action, action === 'create' ? { name: n } : { code, name: n }); if (r.code) setCode(r.code); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const hostName = useMemo(() => table?.seats.find(s => s.uid === table.hostUid)?.name, [table?.hostUid, table?.seats]);

  if (error && !uid) return <Screen><TopBar onBack={onBack} title="Baccalauréat" /><div className="px-5 pt-4"><Note tone="danger">{error}</Note></div></Screen>;
  if (!uid) return <div className="min-h-[100dvh]" style={{ background: FELT }} />;

  if (!code) return (
    <NameStep topTitle="Baccalauréat" eyebrow="Le petit bac entre amis" title="Une lettre, des catégories, le plus rapide dit STOP."
      desc="Crée une table et envoie le lien : chacun joue sur son téléphone, sans feuille ni stylo. Celui qui quitte l'appli pour chercher sur internet, ça se voit."
      cta="Créer une table" initial={name} busy={busy} error={error} onBack={onBack || (() => undefined)} onSubmit={n => go('create', n)} />
  );
  if (table === undefined) return <div className="min-h-[100dvh]" style={{ background: FELT }} />;
  if (table === null) return (
    <Screen><TopBar onBack={exit} title="Baccalauréat" />
      <div className="px-5 pt-4 flex flex-col gap-3"><Note tone="warn">{ERRORS.table_introuvable}</Note><Button onClick={exit}>Retour</Button></div>
    </Screen>
  );
  const seated = table.seats.some(s => s.uid === uid);
  if (!seated) {
    if (table.status !== 'lobby') return (
      <Screen><TopBar onBack={exit} title="Baccalauréat" />
        <div className="px-5 pt-4 flex flex-col gap-3"><Note tone="warn">{ERRORS.partie_commencee}</Note><Button onClick={exit}>Retour</Button></div>
      </Screen>
    );
    return (
      <NameStep topTitle="Baccalauréat" eyebrow="Le petit bac entre amis" title={`La table de ${hostName || 'ton ami'}`}
        desc={`Table ${table.code} · ${table.seats.length} joueur${table.seats.length > 1 ? 's' : ''} · ${table.rounds} manches.`}
        cta="M'asseoir à la table" initial={name} busy={busy} error={error} onBack={exit} onSubmit={n => go('join', n)} />
    );
  }
  if (table.status === 'lobby') return <Lobby t={table} uid={uid} onLeave={leave} />;
  if (table.status === 'writing') return <Writing key={`${table.round}`} t={table} uid={uid} onExit={exit} />;
  if (table.status === 'review') return <Review t={table} uid={uid} onExit={exit} />;
  return <Scores t={table} uid={uid} onExit={exit} />;
};

export default Bac;
