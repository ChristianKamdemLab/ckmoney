import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Screen, TopBar, Button, Chips, Note, Card as Box, Avatar, Field, Toast, Icon, inputClass, inputStyle, C, firstName } from './ui';
import { Card, Play } from '../../games/fapfap';
import { TableView, TableModel, FELT } from './JamboTable';
import { Felt, NameStep } from './GameKit';
import { ensurePlayer, jambo, watchTable, watchHand, tableLink, savedName, saveName, OnlineTable, ERRORS } from '../../services/jamboOnline';

// Jambo en ligne : une table, un lien WhatsApp, chacun joue depuis son téléphone.
// Le serveur arbitre ; si quelqu'un ne joue pas en 30 s, l'ordinateur joue à sa place.

const errorText = (e: unknown) => ERRORS[(e as Error)?.message] || 'Un souci de connexion. Réessaie.';

/** Salle d'attente : on partage le lien, l'hôte ajoute l'ordinateur s'il veut, puis lance. */
const Lobby: React.FC<{ t: OnlineTable; uid: string; onLeave: () => void }> = ({ t, uid, onLeave }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const isHost = t.hostUid === uid;
  const host = t.seats.find(s => s.uid === t.hostUid);
  const link = tableLink(t.code);
  const share = `Viens jouer au Fap Fap avec moi, on joue pour des points. Table ${t.code} : ${link}`;
  const act = async (key: string, action: string, body: Record<string, unknown> = {}) => {
    setBusy(key);
    try { await jambo(action, { code: t.code, ...body }); } catch (e) { setToast(errorText(e)); } finally { setBusy(null); }
  };
  return (
    <Screen>
      <TopBar onBack={onLeave} title="Table de jeu" />
      <Felt>
        <div className="text-[13px] font-semibold" style={{ color: C.ochre }}>Table</div>
        <div className="serif text-[40px] font-semibold tracking-[3px] leading-none mt-1">{t.code}</div>
        <p className="text-[14px] leading-relaxed mt-3" style={{ color: 'rgba(255,255,255,.75)' }}>Envoie le lien à tes amis : ils entrent leur prénom et s'assoient. Pas besoin de compte.</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer"
            className="h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-bold text-white" style={{ background: C.green }}>
            <Icon name="chat" size={18} /> WhatsApp
          </a>
          <button onClick={() => { navigator.clipboard?.writeText(link); setToast('Lien copié'); }}
            className="h-11 rounded-xl flex items-center justify-center gap-2 text-[14px] font-bold" style={{ background: 'rgba(255,255,255,.12)' }}>
            <Icon name="copy" size={18} /> Copier le lien
          </button>
        </div>
      </Felt>

      <div className="px-5 pt-6 pb-2 text-[15px] font-bold">Joueurs ({t.seats.length} sur 4)</div>
      <div className="px-5">
        <Box>
          {Array.from({ length: 4 }, (_, i) => {
            const s = t.seats[i];
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                {s ? <Avatar name={s.name} size={36} tone={i} /> : <div className="w-9 h-9 rounded-full border-2 border-dashed" style={{ borderColor: C.border }} />}
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold truncate" style={{ color: s ? C.ink : C.mute }}>{s ? s.name : 'Place libre'}</div>
                  {s && <div className="text-[12px]" style={{ color: C.mute }}>
                    {[s.uid === uid ? 'toi' : '', s.uid === t.hostUid ? 'organise la partie' : '', s.bot ? 'ordinateur' : ''].filter(Boolean).join(' · ')}
                  </div>}
                </div>
                {s?.bot && isHost && (
                  <button onClick={() => act(`rm${i}`, 'removeBot', { index: i })} aria-label={`Retirer ${s.name}`} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: C.mute }}>
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
            );
          })}
        </Box>
      </div>
      {isHost && t.seats.length < 4 && (
        <div className="px-5 pt-3"><Button variant="secondary" busy={busy === 'bot'} onClick={() => act('bot', 'addBot')}><Icon name="plus" size={20} /> Ajouter l'ordinateur</Button></div>
      )}
      <div className="px-5 pt-5">
        <div className="text-[13px] font-semibold mb-2" style={{ color: C.text2 }}>Partie en</div>
        {isHost
          ? <Chips options={[{ id: '5', label: '5 points' }, { id: '10', label: '10 points' }, { id: '15', label: '15 points' }]} value={String(t.target)} onChange={v => act('target', 'setTarget', { target: Number(v) })} />
          : <div className="text-[15px] font-semibold">{t.target} points</div>}
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        {isHost ? (
          <>
            {t.seats.length < 2 && <Note>En attente d'au moins un autre joueur. Tu peux aussi ajouter l'ordinateur.</Note>}
            <Button busy={busy === 'start'} disabled={t.seats.length < 2} onClick={() => act('start', 'start')}>Lancer la partie</Button>
          </>
        ) : <Note>En attente : {host?.name || "l'organisateur"} lance la partie dès que tout le monde est là.</Note>}
        <Button variant="ghost" onClick={onLeave}>Quitter la table</Button>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Screen>
  );
};

/** La partie, vue depuis sa place : on remet les indices pour que « toi » soit toujours en bas. */
const OnlineGame: React.FC<{ t: OnlineTable; uid: string; hand: Card[]; onExit: () => void }> = ({ t, uid, hand, onExit }) => {
  const n = t.seats.length;
  const me = Math.max(0, t.seats.findIndex(s => s.uid === uid));
  const v = (seat: number) => (seat - me + n) % n;
  const rot = <T,>(arr: T[] = []) => arr.map((_, i) => arr[(i + me) % n]);
  const mapPlays = (ps: Play[] = []) => ps.map(x => ({ p: v(x.p), c: x.c }));
  const [now, setNow] = useState(Date.now());
  const [hold, setHold] = useState<{ plays: Play[]; winner: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const seen = useRef<number>(t.lastTrick?.at || 0);

  // Le pli ramassé reste affiché un instant, pour que chacun voie qui l'a remporté
  useEffect(() => {
    const lt = t.lastTrick;
    if (!lt || lt.at === seen.current) return;
    seen.current = lt.at;
    if (Date.now() - lt.at > 4000) return;
    setHold({ plays: lt.plays, winner: lt.winner });
    const k = setTimeout(() => setHold(null), 1600);
    return () => clearTimeout(k);
  }, [t.lastTrick?.at]);

  useEffect(() => { const k = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(k); }, []);

  // Faire jouer l'ordinateur (place ordinateur, ou joueur absent depuis 30 s). Tous les téléphones
  // peuvent le demander ; le serveur ne joue qu'une fois (numéro de version).
  useEffect(() => {
    if (t.status !== 'playing' || t.result || t.turn === null || t.turn === undefined || !t.deadline) return;
    let k: ReturnType<typeof setTimeout>;
    let alive = true;
    const go = (delay: number) => {
      k = setTimeout(async () => {
        if (!alive) return;
        try {
          const r = await jambo('tick', { code: t.code, version: t.version });
          if (alive && r?.wait) go(r.wait + 250);
        } catch { if (alive) go(3000); }
      }, Math.max(250, delay) + Math.random() * 300);
    };
    go(t.deadline - Date.now() + 150);
    return () => { alive = false; clearTimeout(k); };
  }, [t.version]);

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    try { await jambo(action, { code: t.code, version: t.version, ...body }); }
    catch (e) { if ((e as Error).message !== 'stale') setToast(errorText(e)); }
  };

  const names = rot(t.seats.map(s => s.name));
  const m: TableModel = {
    names, bots: rot(t.seats.map(s => s.bot)), scores: rot(t.scores), counts: rot(t.counts), myHand: hand,
    target: t.target, round: t.round || 1, trickNo: t.trickNo || 1, leader: v(t.leader || 0),
    turn: t.turn === null || t.turn === undefined ? null : v(t.turn),
    trick: hold ? mapPlays(hold.plays) : mapPlays(t.trick),
    result: t.result ? { ...t.result, winner: v(t.result.winner) } : null,
    matchWinner: t.matchWinner === null || t.matchWinner === undefined ? null : v(t.matchWinner),
  };
  const banner = hold ? (v(hold.winner) === 0 ? 'Tu remportes le pli' : `${names[v(hold.winner)]} remporte le pli`) : null;
  const secondsLeft = t.deadline && m.turn !== null && !m.bots[m.turn] ? Math.ceil((t.deadline - now) / 1000) : null;
  const auto = t.auto && now - t.auto.at < 6000 ? (v(t.auto.seat) === 0 ? "Temps écoulé : l'ordinateur a joué pour toi." : `Temps écoulé : l'ordinateur a joué pour ${names[v(t.auto.seat)]}.`) : null;

  return (
    <>
      <TableView m={m} banner={banner} locked={!!hold} secondsLeft={secondsLeft} note={auto} showResult={!hold}
        onPlay={c => act('play', { card: c })} onClaim={() => act('claim')} onNext={() => act('next')}
        onReplay={() => act('rematch')} replayLabel="Revanche" onQuit={onExit} topLabel={`Table ${t.code}`}
        quitTitle="Quitter la table ?" quitText="Tu pourras revenir avec le même lien. Pendant ton absence, l'ordinateur joue pour toi au bout de 30 secondes." />
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
};

const JamboOnline: React.FC<{ code?: string; target?: number; defaultName: string; guest?: boolean; onExit: () => void }> = ({ code: initialCode, target = 10, defaultName, guest, onExit }) => {
  const [uid, setUid] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [code, setCode] = useState<string | null>(initialCode || null);
  const [table, setTable] = useState<OnlineTable | null | undefined>(undefined);
  const [hand, setHand] = useState<Card[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = savedName() || defaultName || accountName;

  useEffect(() => {
    ensurePlayer()
      .then(u => { setUid(u.uid); if (!u.isAnonymous && u.displayName) setAccountName(firstName(u.displayName)); })
      .catch(() => setError("Connexion impossible. Vérifie ta connexion internet."));
  }, []);
  useEffect(() => (code && uid ? watchTable(code, setTable, () => setTable(null)) : undefined), [code, uid]);
  useEffect(() => (code && uid ? watchHand(code, uid, setHand) : undefined), [code, uid]);

  // Sur la page publique, l'adresse garde le code : un rechargement ramène à la table
  useEffect(() => {
    if (!guest) return;
    try { window.history.replaceState({}, '', code ? `/jambo?t=${code}` : '/jambo'); } catch { /* ignore */ }
  }, [code, guest]);

  const exit = () => { if (guest) { try { window.history.replaceState({}, '', '/jambo'); } catch { /* ignore */ } } onExit(); };
  const leave = async () => { if (code) await jambo('leave', { code }).catch(() => undefined); exit(); };

  const create = async (n: string) => {
    setBusy(true); setError(null); saveName(n);
    try { const r = await jambo('create', { name: n, target }); setCode(r.code); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const join = async (n: string) => {
    if (!code) return;
    setBusy(true); setError(null); saveName(n);
    try { await jambo('join', { code, name: n }); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  const seated = !!(table && uid && table.seats.some(s => s.uid === uid));
  const hostName = useMemo(() => table?.seats.find(s => s.uid === table.hostUid)?.name, [table?.hostUid, table?.seats]);

  if (error && !uid) return <Screen><TopBar onBack={exit} title="Jambo en ligne" /><div className="px-5 pt-4"><Note tone="danger">{error}</Note></div></Screen>;
  if (!uid) return <div className="min-h-[100dvh]" style={{ background: FELT }} />;

  // Créer une table
  if (!code) return (
    <NameStep topTitle="Jambo en ligne" eyebrow="Fap Fap entre amis" title="Ta table de Fap Fap" desc="Donne ton prénom, puis envoie le lien de la table à tes amis." cta="Créer la table"
      initial={name} busy={busy} error={error} onBack={exit} onSubmit={create} />
  );

  if (table === undefined) return <div className="min-h-[100dvh]" style={{ background: FELT }} />;
  if (table === null) return (
    <Screen>
      <TopBar onBack={exit} title="Jambo en ligne" />
      <div className="px-5 pt-4 flex flex-col gap-3"><Note tone="warn">{ERRORS.table_introuvable}</Note><Button onClick={exit}>Retour</Button></div>
    </Screen>
  );

  // Rejoindre
  if (!seated) {
    if (table.status !== 'lobby') return (
      <Screen>
        <TopBar onBack={exit} title="Jambo en ligne" />
        <div className="px-5 pt-4 flex flex-col gap-3"><Note tone="warn">{ERRORS.partie_commencee}</Note><Button onClick={exit}>Retour</Button></div>
      </Screen>
    );
    return (
      <NameStep topTitle="Jambo en ligne" eyebrow="Fap Fap entre amis" title={`La table de ${hostName || 'ton ami'}`} desc={`Table ${table.code} · ${table.seats.length} joueur${table.seats.length > 1 ? 's' : ''} sur 4 · partie en ${table.target} points.`}
        cta="M'asseoir à la table" initial={name} busy={busy} error={error} onBack={exit} onSubmit={join} />
    );
  }

  if (table.status === 'lobby') return <Lobby t={table} uid={uid} onLeave={leave} />;
  return <OnlineGame t={table} uid={uid} hand={hand} onExit={exit} />;
};

export default JamboOnline;
