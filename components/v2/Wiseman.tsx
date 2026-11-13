import React, { useEffect, useMemo, useState } from 'react';
import { Screen, TopBar, Button, Note, Card as Box, Avatar, Toast, Icon, inputClass, inputStyle, C, firstName } from './ui';
import { Felt, NameStep, ShareBox, nameOf } from './GameKit';
import { FELT } from './JamboTable';
import { ensurePlayer, savedName, saveName, ERRORS } from '../../services/jamboOnline';
import { wiseman, watchWiseman, watchCard, wisemanLink, WisemanTable, WisemanCard } from '../../services/wisemanOnline';
import { ROLE_LABEL, POINTS, MIN_PLAYERS, BLANK_MIN_PLAYERS, Role } from '../../games/wiseman';

// Le Wiseman (jeu de l'intrus) en ligne : un mot secret chacun, un indice à tour de rôle, un vote.

const errorText = (e: unknown) => ({ ...ERRORS, trop_peu: 'Il faut au moins 3 joueurs.', indice: 'Écris un indice.', vote: 'Vote impossible.' } as Record<string, string>)[(e as Error)?.message] || 'Un souci de connexion. Réessaie.';
const useNow = () => { const [n, setN] = useState(Date.now()); useEffect(() => { const k = setInterval(() => setN(Date.now()), 500); return () => clearInterval(k); }, []); return n; };
const WINNER_TEXT = { civils: 'Les civils gagnent', imposteurs: 'Les imposteurs gagnent', blanc: 'Le sans mot gagne' } as const;

const RulesNote: React.FC = () => (
  <Note>Les civils ont tous le même mot, l'intrus un mot proche, et personne ne connaît son rôle. Chacun donne un indice à son tour, puis on vote : le plus désigné sort. Points : civil {POINTS.civil}, intrus {POINTS.intrus}, sans mot {POINTS.blanc}.</Note>
);

// ---------- Salle d'attente

const Lobby: React.FC<{ t: WisemanTable; uid: string; onLeave: () => void }> = ({ t, uid, onLeave }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const isHost = t.hostUid === uid;
  const act = async (k: string, action: string, body: Record<string, unknown> = {}) => {
    setBusy(k); try { await wiseman(action, { code: t.code, ...body }); } catch (e) { setToast(errorText(e)); } finally { setBusy(null); }
  };
  const blankOk = t.seats.length >= BLANK_MIN_PLAYERS;
  return (
    <Screen>
      <TopBar onBack={onLeave} title="Le Wiseman" />
      <ShareBox name={nameOf(t)} code={t.code} link={wisemanLink(t.code)} text={`On joue au Wiseman ? Trouve l'intrus avant qu'il ne te piège. Table ${nameOf(t)} : ${wisemanLink(t.code)}`} onCopied={() => setToast('Lien copié')}
        onRename={isHost ? () => act('rename', 'rename') : undefined} renaming={busy === 'rename'} />
      <div className="px-5 pt-6 pb-2 text-[15px] font-bold">Joueurs ({t.seats.length} sur 10)</div>
      <div className="px-5">
        <Box>
          {t.seats.map((s, i) => (
            <div key={s.uid} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
              <Avatar name={s.name} size={36} tone={i} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold truncate">{s.name}</div>
                <div className="text-[12px]" style={{ color: C.mute }}>{[s.uid === uid ? 'toi' : '', s.uid === t.hostUid ? 'organise la partie' : '', t.scores?.[s.uid] ? `${t.scores[s.uid]} pts` : ''].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </Box>
      </div>
      <div className="px-5 pt-5 flex flex-col gap-3">
        {isHost ? (
          <button onClick={() => act('blank', 'config', { withBlank: !t.withBlank })} disabled={!!busy}
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left" style={{ background: C.card }}>
            <span className="w-11 h-6 rounded-full relative shrink-0 transition" style={{ background: t.withBlank ? C.ink : C.border }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: t.withBlank ? 22 : 2 }} />
            </span>
            <span className="flex-1">
              <span className="text-[15px] font-semibold block">Ajouter un joueur sans mot</span>
              <span className="text-[12px]" style={{ color: C.mute }}>{blankOk ? "Il ne reçoit rien et doit bluffer ; éliminé, il peut deviner le mot pour gagner." : `À partir de ${BLANK_MIN_PLAYERS} joueurs.`}</span>
            </span>
          </button>
        ) : t.withBlank && <Note>Avec un joueur sans mot (à partir de {BLANK_MIN_PLAYERS} joueurs).</Note>}
        <RulesNote />
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        {isHost ? (
          <>
            {t.seats.length < MIN_PLAYERS && <Note>En attente : il faut au moins {MIN_PLAYERS} joueurs.</Note>}
            <Button busy={busy === 'start'} disabled={t.seats.length < MIN_PLAYERS} onClick={() => act('start', 'start')}>Lancer la partie</Button>
          </>
        ) : <Note>En attente : {t.seats.find(s => s.uid === t.hostUid)?.name || "l'organisateur"} lance la partie.</Note>}
        <Button variant="ghost" onClick={onLeave}>Quitter la table</Button>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

// ---------- Partie

const SecretCard: React.FC<{ card: WisemanCard | null }> = ({ card }) => {
  const [shown, setShown] = useState(false);
  return (
    <button onClick={() => setShown(!shown)} className="mx-5 mt-1 rounded-[24px] px-6 py-5 text-white text-left" style={{ background: FELT }}>
      <div className="text-[13px] font-semibold" style={{ color: C.ochre }}>{card?.blank ? 'Tu es le sans mot' : 'Ton mot secret'}</div>
      {card?.blank
        ? <div className="text-[15px] leading-snug mt-1.5" style={{ color: 'rgba(255,255,255,.85)' }}>Tu n'as pas de mot. Écoute les indices et fais comme si tu savais.</div>
        : <div className="serif text-[32px] font-semibold leading-tight mt-1">{shown ? card?.word || '…' : '• • • • •'}</div>}
      {!card?.blank && <div className="text-[12px] mt-1.5" style={{ color: 'rgba(255,255,255,.55)' }}>{shown ? 'Touche pour cacher' : 'Touche pour voir (cache-le aux voisins)'}</div>}
    </button>
  );
};

const Game: React.FC<{ t: WisemanTable; uid: string; card: WisemanCard | null; onExit: () => void }> = ({ t, uid, card, onExit }) => {
  const now = useNow();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<{ round: number; target: string } | null>(null);
  const name = (u?: string | null) => (u === uid ? 'Toi' : t.seats.find(s => s.uid === u)?.name || '?');
  const out = new Map((t.eliminated || []).map(e => [e.uid, e.role]));
  const amOut = out.has(uid);
  const left = Math.max(0, Math.ceil(((t.deadline || 0) - now) / 1000));

  // Faire avancer la partie quand le temps est écoulé (n'importe quel téléphone peut le demander)
  useEffect(() => {
    if (!t.deadline || !['clues', 'vote', 'guess'].includes(t.status)) return;
    let alive = true, k: ReturnType<typeof setTimeout>;
    const go = (d: number) => { k = setTimeout(async () => { if (!alive) return; try { const r = await wiseman('tick', { code: t.code, version: t.version }); if (alive && r?.wait) go(r.wait + 200); } catch { if (alive) go(3000); } }, Math.max(300, d) + Math.random() * 400); };
    go(t.deadline - Date.now() + 200);
    return () => { alive = false; clearTimeout(k); };
  }, [t.version]);

  const act = async (action: string, body: Record<string, unknown>) => {
    setBusy(true);
    try { await wiseman(action, { code: t.code, ...body }); setText(''); return true; }
    catch (e) { setToast(errorText(e)); return false; } finally { setBusy(false); }
  };

  const rounds = useMemo(() => {
    const m = new Map<number, { uid: string; text: string }[]>();
    (t.clues || []).forEach(c => m.set(c.round, [...(m.get(c.round) || []), c]));
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [t.clues]);

  const last = t.lastOut && t.lastOut.round === (t.round || 1) - 1 && t.status === 'clues' ? t.lastOut : null;
  const voteOf = myVote?.round === t.round ? myVote.target : null;
  const phase = t.status === 'clues'
    ? (t.turnUid === uid ? `À toi : donne un indice (${left} s)` : `${name(t.turnUid)} cherche son indice… ${left} s`)
    : t.status === 'vote' ? `Vote : qui est l'intrus ? ${(t.voted || []).length}/${(t.order || []).length} · ${left} s`
    : t.turnUid === uid ? `Tu es éliminé, mais tu peux encore gagner : devine le mot des civils (${left} s)`
    : `${name(t.turnUid)} (sans mot) tente de deviner le mot… ${left} s`;

  return (
    <Screen>
      <TopBar onBack={onExit} title={`Tour ${t.round}`} right={<div className="text-[15px] font-bold tabular-nums pr-2" style={{ color: left <= 10 ? C.red : C.ink }}>{left}s</div>} />
      <SecretCard card={card} />
      {last && (
        <div className="px-5 pt-3">
          <Note tone={last.uid ? (last.role === 'civil' ? 'warn' : 'ok') : 'info'}>
            {last.uid ? `${name(last.uid)} ${last.uid === uid ? 'es sorti' : 'est sorti'} : c'était ${last.role === 'civil' ? 'un civil' : last.role === 'intrus' ? "l'intrus" : 'le sans mot'}.` : 'Égalité au vote : personne ne sort.'}
            {t.guess && !t.guess.ok && t.guess.uid === last.uid ? ` Il a tenté « ${t.guess.word || '…'} », raté.` : ''}
          </Note>
        </div>
      )}
      <div className="px-5 pt-3"><div className="rounded-2xl px-4 py-3 text-[14px] font-semibold" style={{ background: C.ochreSoft, color: C.ochreText }} role="status">{phase}</div></div>

      {t.status === 'clues' && t.turnUid === uid && (
        <form className="px-5 pt-3 flex gap-2" onSubmit={async e => { e.preventDefault(); if (text.trim()) await act('clue', { text }); }}>
          <input value={text} onChange={e => setText(e.target.value)} maxLength={30} autoFocus placeholder="Un mot ou deux" autoComplete="off" className={inputClass} style={inputStyle} />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Envoyer l'indice" className="w-[52px] shrink-0 rounded-[14px] flex items-center justify-center disabled:opacity-40" style={{ background: C.ink, color: '#fff' }}><Icon name="arrow" /></button>
        </form>
      )}
      {t.status === 'guess' && t.turnUid === uid && (
        <form className="px-5 pt-3 flex gap-2" onSubmit={async e => { e.preventDefault(); if (text.trim()) await act('guess', { word: text }); }}>
          <input value={text} onChange={e => setText(e.target.value)} maxLength={30} autoFocus placeholder="Le mot des civils" autoComplete="off" className={inputClass} style={inputStyle} />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Proposer" className="w-[52px] shrink-0 rounded-[14px] flex items-center justify-center disabled:opacity-40" style={{ background: C.ink, color: '#fff' }}><Icon name="check" /></button>
        </form>
      )}

      <div className="px-5 pt-5 pb-2 text-[15px] font-bold">{t.status === 'vote' && !amOut ? 'Vote contre…' : 'Joueurs'}</div>
      <div className="px-5">
        <Box>
          {t.seats.map((s, i) => {
            const role = out.get(s.uid) as Role | undefined;
            const canVote = t.status === 'vote' && !amOut && !role && s.uid !== uid;
            const chosen = voteOf === s.uid;
            return (
              <div key={s.uid} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : undefined, opacity: role ? 0.55 : 1 }}>
                <Avatar name={s.name} size={32} tone={i} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[15px] font-semibold truncate ${role ? 'line-through' : ''}`}>{s.uid === uid ? `${s.name} (toi)` : s.name}</div>
                  <div className="text-[12px]" style={{ color: C.mute }}>
                    {role ? `éliminé · ${ROLE_LABEL[role]}` : t.status === 'clues' && t.turnUid === s.uid ? 'donne son indice' : t.status === 'vote' && (t.voted || []).includes(s.uid) ? 'a voté' : ''}
                  </div>
                </div>
                {canVote && (
                  <button disabled={busy} onClick={async () => { if (await act('vote', { target: s.uid })) setMyVote({ round: t.round || 1, target: s.uid }); }}
                    className="h-9 px-4 rounded-full text-[13px] font-bold" style={{ background: chosen ? C.red : C.soft, color: chosen ? '#fff' : C.ink }}>
                    {chosen ? 'Ton vote' : 'Voter'}
                  </button>
                )}
              </div>
            );
          })}
        </Box>
        {t.status === 'vote' && voteOf && <div className="text-[12px] mt-2" style={{ color: C.mute }}>Tu peux changer ton vote tant que tout le monde n'a pas voté.</div>}
        {amOut && t.status !== 'guess' && <div className="pt-3"><Note>Tu es éliminé : tu suis la fin de la partie sans voter.</Note></div>}
      </div>

      <div className="px-5 pt-5 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-3">
        {rounds.map(([r, list]) => (
          <div key={r}>
            <div className="text-[13px] font-bold mb-1.5" style={{ color: C.ochreText }}>Indices du tour {r}</div>
            <Box>
              {list.map((c, i) => (
                <div key={i} className="flex gap-3 px-4 py-2.5 text-[15px]" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                  <span className="w-20 shrink-0 truncate" style={{ color: C.mute }}>{name(c.uid)}</span>
                  <span className="font-semibold" style={{ color: c.text ? C.ink : C.mute }}>{c.text || '(pas d’indice)'}</span>
                </div>
              ))}
            </Box>
          </div>
        ))}
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

const End: React.FC<{ t: WisemanTable; uid: string; onExit: () => void }> = ({ t, uid, onExit }) => {
  const [busy, setBusy] = useState(false);
  const roles = t.reveal?.roles || {};
  const ranking = t.seats.slice().sort((a, b) => (t.scores?.[b.uid] || 0) - (t.scores?.[a.uid] || 0));
  return (
    <Screen>
      <TopBar onBack={onExit} title="Fin de la partie" />
      <Felt>
        <div className="text-[13px] font-semibold" style={{ color: C.ochre }}>Partie {t.games}</div>
        <h1 className="serif text-[30px] font-semibold leading-tight mt-1">{t.winner ? WINNER_TEXT[t.winner] : ''}</h1>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.08)' }}>
            <div className="text-[12px]" style={{ color: 'rgba(255,255,255,.6)' }}>Mot des civils</div>
            <div className="serif text-[20px] font-semibold">{t.reveal?.civil}</div>
          </div>
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.08)' }}>
            <div className="text-[12px]" style={{ color: 'rgba(255,255,255,.6)' }}>Mot de l'intrus</div>
            <div className="serif text-[20px] font-semibold">{t.reveal?.intrus}</div>
          </div>
        </div>
        {t.guess?.ok && <div className="text-[14px] mt-3" style={{ color: 'rgba(255,255,255,.8)' }}>Le sans mot a deviné « {t.guess.word} ».</div>}
      </Felt>
      <div className="px-5 pt-5">
        <Box>
          {ranking.map((s, i) => (
            <div key={s.uid} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold truncate">{s.uid === uid ? 'Toi' : s.name}</div>
                <div className="text-[12px]" style={{ color: roles[s.uid] === 'civil' ? C.mute : C.ochreText }}>{roles[s.uid] ? ROLE_LABEL[roles[s.uid]] : ''}</div>
              </div>
              <div className="text-[16px] font-bold tabular-nums">{t.scores?.[s.uid] || 0} pts</div>
            </div>
          ))}
        </Box>
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        <Button busy={busy} onClick={async () => { setBusy(true); try { await wiseman('rematch', { code: t.code }); } catch { /* l'écran suivra */ } finally { setBusy(false); } }}>Nouvelle partie, mêmes joueurs</Button>
        <Button variant="secondary" onClick={onExit}>Quitter</Button>
      </div>
    </Screen>
  );
};

// ---------- Entrée

const Wiseman: React.FC<{ playerName: string; onBack?: () => void; guest?: boolean; tableCode?: string }> = ({ playerName, onBack, guest, tableCode }) => {
  const [uid, setUid] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [code, setCode] = useState<string | null>(tableCode || null);
  const [table, setTable] = useState<WisemanTable | null | undefined>(undefined);
  const [card, setCard] = useState<WisemanCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = savedName() || firstName(playerName) || accountName;

  useEffect(() => {
    ensurePlayer()
      .then(u => { setUid(u.uid); if (!u.isAnonymous && u.displayName) setAccountName(firstName(u.displayName)); })
      .catch(() => setError('Connexion impossible. Vérifie ta connexion internet.'));
  }, []);
  useEffect(() => (code && uid ? watchWiseman(code, setTable) : undefined), [code, uid]);
  useEffect(() => (code && uid ? watchCard(code, uid, setCard) : undefined), [code, uid]);
  useEffect(() => {
    if (!guest) return;
    try { window.history.replaceState({}, '', code ? `/wiseman?t=${code}` : '/wiseman'); } catch { /* ignore */ }
  }, [code, guest]);

  const exit = () => { setCode(null); setTable(undefined); if (onBack) onBack(); };
  const leave = async () => { if (code) await wiseman('leave', { code }).catch(() => undefined); exit(); };
  const go = async (action: 'create' | 'join', n: string) => {
    setBusy(true); setError(null); saveName(n);
    try { const r = await wiseman(action, action === 'create' ? { name: n } : { code, name: n }); if (r.code) setCode(r.code); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const hostName = table?.seats.find(s => s.uid === table.hostUid)?.name;

  if (error && !uid) return <Screen><TopBar onBack={onBack} title="Le Wiseman" /><div className="px-5 pt-4"><Note tone="danger">{error}</Note></div></Screen>;
  if (!uid) return <div className="min-h-[100dvh]" style={{ background: FELT }} />;
  if (!code) return (
    <NameStep topTitle="Le Wiseman" eyebrow="Trouve l'intrus" title="Un mot secret chacun. Un intrus parmi vous."
      desc="Crée une table et envoie le lien. Chacun donne un indice à son tour, puis on vote pour éliminer l'intrus, sans compte."
      cta="Créer une table" initial={name} busy={busy} error={error} onBack={onBack || (() => undefined)} onSubmit={n => go('create', n)} />
  );
  if (table === undefined) return <div className="min-h-[100dvh]" style={{ background: FELT }} />;
  if (table === null) return (
    <Screen><TopBar onBack={exit} title="Le Wiseman" />
      <div className="px-5 pt-4 flex flex-col gap-3"><Note tone="warn">{ERRORS.table_introuvable}</Note><Button onClick={exit}>Retour</Button></div>
    </Screen>
  );
  if (!table.seats.some(s => s.uid === uid)) {
    if (table.status !== 'lobby') return (
      <Screen><TopBar onBack={exit} title="Le Wiseman" />
        <div className="px-5 pt-4 flex flex-col gap-3"><Note tone="warn">{ERRORS.partie_commencee}</Note><Button onClick={exit}>Retour</Button></div>
      </Screen>
    );
    return (
      <NameStep topTitle="Le Wiseman" eyebrow="Trouve l'intrus" title={`Table ${nameOf(table)}`}
        desc={`Avec ${hostName || 'ton ami'} · ${table.seats.length} joueur${table.seats.length > 1 ? 's' : ''}.`}
        cta="M'asseoir à la table" initial={name} busy={busy} error={error} onBack={exit} onSubmit={n => go('join', n)} />
    );
  }
  if (table.status === 'lobby') return <Lobby t={table} uid={uid} onLeave={leave} />;
  if (table.status === 'end') return <End t={table} uid={uid} onExit={exit} />;
  return <Game t={table} uid={uid} card={card?.game === table.games ? card : null} onExit={exit} />;
};

export default Wiseman;
