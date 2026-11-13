import React, { useEffect, useMemo, useState } from 'react';
import { Screen, TopBar, Button, Card, Note, Sheet, Toast, Skeleton, Field, Chips, inputClass, inputStyle, Icon, C, firstName } from './ui';
import { EventDetail, EventRow } from './EventView';
import { listEvents, saveEvent, deleteEvent, rsvp, listRsvps, listPeople } from '../../services/eventService';
import { AppEvent, Audience, EventInput, EventKind, Region, AUDIENCE_LABEL, KIND_LABEL, isLive, isUpcoming, toLocalInput, fromLocalInput, defaultSpotEnd, parisDay, dayStart, dayEnd, regionOf, monthOf } from '../../utils/events';

// Sorties : événements (salons…), spots (« je suis au bar X ») et chills organisés par l'auteur.
// L'auteur choisit qui voit chaque sortie dans l'appli ; chacune a aussi sa page publique (/e/ID).

type Form = {
  id?: string; kind: EventKind; title: string; start: string; end: string; venue: string; address: string; url: string;
  price: string; organizer: string; description: string; theme: string; drinks: string; capacity: string;
  audience: Audience; invitees: string[];
  allDay: boolean; // événement sans horaire : start et end sont des jours (« 2026-11-18 »)
};

const roundNow = () => { const d = new Date(); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0); return d.toISOString(); };
const emptyForm = (kind: EventKind, me: string): Form => ({
  kind, title: '', start: kind === 'spot' ? toLocalInput(roundNow()) : '', end: '', venue: '', address: '', url: '',
  price: kind === 'event' ? 'Gratuit' : '', organizer: kind === 'event' ? '' : me, description: '', theme: '', drinks: '', capacity: '',
  audience: 'all', invitees: [], allDay: false,
});

const fromEvent = (e: AppEvent): Form => ({
  id: e.id, kind: e.kind, title: e.title, venue: e.venue, address: e.address,
  start: e.allDay ? parisDay(e.startsAt) : toLocalInput(e.startsAt), end: e.allDay ? parisDay(e.endsAt) : toLocalInput(e.endsAt),
  url: e.url, price: e.price, organizer: e.organizer, description: e.description, theme: e.theme, drinks: e.drinks,
  capacity: e.capacity ? String(e.capacity) : '', audience: e.audience || 'all', invitees: e.invitees || [], allDay: !!e.allDay,
});

/** Lien préparé (/?preparer=…) : on ne garde que les champs attendus. */
const fromPrefill = (p: Partial<EventInput>): Partial<Form> => {
  const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 2000) : undefined);
  const out: Partial<Form> = {};
  (['title', 'venue', 'address', 'url', 'price', 'organizer', 'description', 'theme', 'drinks'] as const).forEach(k => { const v = str(p[k]); if (v !== undefined) out[k] = v; });
  if (p.kind === 'spot' || p.kind === 'chill' || p.kind === 'event') out.kind = p.kind;
  if (p.audience === 'all' || p.audience === 'link') out.audience = p.audience;
  const allDay = p.allDay === true && (out.kind || 'event') === 'event';
  if (allDay) out.allDay = true;
  if (str(p.startsAt)) out.start = allDay ? parisDay(p.startsAt) : toLocalInput(p.startsAt);
  if (str(p.endsAt)) out.end = allDay ? parisDay(p.endsAt) : toLocalInput(p.endsAt);
  if (typeof p.capacity === 'number') out.capacity = String(p.capacity);
  return out;
};

/** Passe le formulaire en « journée entière » (dates seules) ou revient aux heures. */
const untimed = (f: Form, allDay: boolean): Form => allDay === f.allDay ? f : allDay
  ? { ...f, allDay, start: f.start.slice(0, 10), end: f.end.slice(0, 10) }
  : { ...f, allDay, start: f.start ? `${f.start}T10:00` : '', end: f.end ? `${f.end}T18:00` : '' };

const KIND_HINT: Record<EventKind, string> = {
  event: 'Un salon, un concert, une expo…',
  spot: "Là où tu es, ou là où tu seras. Il disparaît tout seul à l'heure de fin.",
  chill: 'Un moment que tu organises. Toi seul vois qui vient.',
};

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }> = ({ on, onChange, label, sub }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="w-full text-left flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: C.card }}>
    <div className="flex-1 min-w-0">
      <div className="text-[15px] font-semibold">{label}</div>
      {sub && <div className="text-[13px] mt-0.5" style={{ color: C.mute }}>{sub}</div>}
    </div>
    <span className="w-12 h-7 rounded-full p-0.5 shrink-0 transition-colors" style={{ background: on ? C.green : C.border }}>
      <span className="block w-6 h-6 rounded-full bg-white shadow transition-transform" style={{ transform: on ? 'translateX(20px)' : 'none' }} />
    </span>
  </button>
);

const PeoplePicker: React.FC<{ value: string[]; onChange: (v: string[]) => void }> = ({ value, onChange }) => {
  const [people, setPeople] = useState<{ uid: string; name: string }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => { listPeople().then(setPeople).catch(() => { setFailed(true); setPeople([]); }); }, []);
  const shown = (people || []).filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (uid: string) => onChange(value.includes(uid) ? value.filter(u => u !== uid) : [...value, uid]);
  return (
    <div className="flex flex-col gap-2">
      {(people?.length || 0) > 8 && <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un prénom" aria-label="Chercher un prénom" className={inputClass} style={inputStyle} />}
      {!people && <Skeleton h={120} />}
      {failed && <Note tone="warn">La liste n'a pas pu être chargée.</Note>}
      {people && !failed && !people.length && <Note>Personne d'autre n'a encore de compte CKMoney.</Note>}
      {shown.length > 0 && (
        <Card>
          {shown.map((p, i) => {
            const on = value.includes(p.uid);
            return (
              <button key={p.uid} type="button" onClick={() => toggle(p.uid)} aria-pressed={on}
                className="w-full text-left flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border-[1.5px]" style={{ background: on ? C.ink : '#fff', borderColor: on ? C.ink : C.border, color: '#fff' }}>
                  {on && <Icon name="check" size={16} />}
                </span>
                <span className="text-[15px] font-medium">{p.name}</span>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
};

const Editor: React.FC<{ initial?: AppEvent; prefill?: Partial<EventInput>; me: string; admin: boolean; onBack: () => void; onSaved: (id?: string, notified?: number) => void }> = ({ initial, prefill, me, admin, onBack, onSaved }) => {
  const [f, setF] = useState<Form>(() => initial ? fromEvent(initial) : { ...emptyForm((prefill?.kind as EventKind) || 'event', me), ...(prefill ? fromPrefill(prefill) : {}) });
  const [notify, setNotify] = useState(!initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setError(null); }, [f]);
  const set = (k: keyof Form) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: ev.target.value });
  const what = f.kind === 'event' ? "l'événement" : f.kind === 'spot' ? 'le spot' : 'le chill';

  const switchKind = (kind: EventKind) => {
    if (kind === f.kind) return;
    const fresh = emptyForm(kind, me);
    const timed = kind !== 'event' && f.allDay ? untimed(f, false) : f;
    setF({
      ...timed, kind,
      start: timed.start || fresh.start,
      price: kind === 'event' ? (f.price || 'Gratuit') : '',
      organizer: kind === 'event' ? (f.organizer === me ? '' : f.organizer) : (f.organizer || me),
    });
  };

  const save = async () => {
    const startsAt = f.allDay ? dayStart(f.start) : fromLocalInput(f.start);
    const endsAt = f.allDay ? dayEnd(f.end || f.start) : fromLocalInput(f.end) || (f.kind === 'spot' && startsAt ? defaultSpotEnd(startsAt) : startsAt);
    if (!f.title.trim() || !startsAt) { setError('Il faut au moins un titre et une date de début.'); return; }
    if (endsAt < startsAt) { setError('La fin doit venir après le début.'); return; }
    if (f.url && !/^https?:\/\//i.test(f.url.trim())) { setError('Le lien doit commencer par https://'); return; }
    if (f.audience === 'some' && !f.invitees.length) { setError('Choisis au moins une personne, ou change « Qui le voit ».'); return; }
    setBusy('save'); setError(null);
    try {
      const { start, end, capacity, ...rest } = f;
      const cap = parseInt(capacity, 10);
      const r = await saveEvent({ ...rest, url: rest.url.trim(), startsAt, endsAt, capacity: cap > 0 ? cap : null }, notify && f.audience !== 'link');
      onSaved(r.id, r.notified);
    } catch (e) {
      const code = (e as Error).message;
      setError(code === 'trop' ? 'Tu as déjà publié 10 sorties aujourd\'hui. Réessaie demain.' : code === 'audience' ? '« Certaines personnes » est réservé à Christian.' : "L'enregistrement a échoué. Réessaie.");
    } finally { setBusy(null); }
  };

  const remove = async () => {
    if (!f.id) return;
    setBusy('delete');
    try { await deleteEvent(f.id); setConfirmDelete(false); onSaved(); }
    catch { setError('La suppression a échoué.'); setConfirmDelete(false); }
    finally { setBusy(null); }
  };

  const input = (id: string, k: keyof Form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={id} value={f[k] as string} onChange={set(k)} className={inputClass} style={inputStyle} {...props} />
  );
  const textarea = (id: string, k: keyof Form, rows: number, placeholder?: string) => (
    <textarea id={id} value={f[k] as string} onChange={set(k)} rows={rows} placeholder={placeholder}
      className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none border-[1.5px] focus:border-[#1C2551]" style={inputStyle} />
  );
  const dates = f.allDay ? (
    <>
      <Field label="Premier jour" htmlFor="es">{input('es', 'start', { type: 'date' })}</Field>
      <Field label="Dernier jour" htmlFor="ee" hint="Vide : un seul jour.">{input('ee', 'end', { type: 'date', min: f.start || undefined })}</Field>
    </>
  ) : (
    <>
      <Field label={f.kind === 'spot' ? 'À partir de' : 'Début'} htmlFor="es">{input('es', 'start', { type: 'datetime-local' })}</Field>
      <Field label={f.kind === 'spot' ? "Jusqu'à" : 'Fin'} htmlFor="ee" hint={f.kind === 'spot' ? 'Vide : 4 h du matin pour un spot du soir, sinon 6 h plus tard. Le spot disparaît tout seul à cette heure-là.' : 'Vide : même heure que le début.'}>
        {input('ee', 'end', { type: 'datetime-local', min: f.start || undefined })}
      </Field>
    </>
  );
  const place = (
    <>
      <Field label="Lieu" htmlFor="ev">{input('ev', 'venue', { placeholder: f.kind === 'spot' ? 'Le Comptoir Général' : f.kind === 'chill' ? 'Chez moi, un bar, un parc…' : 'Palais de la Porte Dorée' })}</Field>
      <Field label="Adresse" htmlFor="ea" hint="Sert à l'itinéraire.">{input('ea', 'address', { placeholder: '80 quai de Jemmapes, 75010 Paris' })}</Field>
    </>
  );

  return (
    <Screen>
      <TopBar onBack={onBack} title={initial ? 'Modifier la sortie' : 'Nouvelle sortie'} />
      <div className="px-5 pt-2 flex flex-col gap-4">
        <div>
          <Chips options={(['event', 'spot', 'chill'] as EventKind[]).map(k => ({ id: k, label: KIND_LABEL[k] }))} value={f.kind} onChange={k => switchKind(k as EventKind)} />
          <p className="text-[13px] mt-2 px-1" style={{ color: C.mute }}>{KIND_HINT[f.kind]}</p>
        </div>
        <Field label="Titre" htmlFor="et">{input('et', 'title', { placeholder: f.kind === 'spot' ? 'Ce soir, je suis au Comptoir' : f.kind === 'chill' ? 'Chill du vendredi' : 'Salon, concert, expo…' })}</Field>
        {f.kind === 'event' && <Toggle on={f.allDay} onChange={v => setF(untimed(f, v))} label="Journée entière, sans horaire" sub="Pour un salon sur plusieurs jours, par exemple" />}
        {f.kind === 'spot' ? <>{place}{dates}</> : <>{dates}{place}</>}
        {f.kind === 'chill' && (
          <>
            <Field label="Thème de discussion" htmlFor="eth">{input('eth', 'theme', { placeholder: "L'argent entre amis, la diaspora, la musique…" })}</Field>
            <Field label="À boire" htmlFor="edr">{input('edr', 'drinks', { placeholder: 'Vin, bières et softs. Ramène ce que tu aimes.' })}</Field>
            <Field label="Nombre de places" htmlFor="eca" hint="Vide : pas de limite.">{input('eca', 'capacity', { type: 'number', inputMode: 'numeric', min: 1, max: 500 })}</Field>
          </>
        )}
        {f.kind === 'event' && (
          <>
            <Field label="Prix" htmlFor="ep">{input('ep', 'price', { placeholder: 'Gratuit' })}</Field>
            <Field label="Organisateur" htmlFor="eo">{input('eo', 'organizer')}</Field>
            <Field label="Lien de réservation" htmlFor="eu" hint="La billetterie ou la page officielle.">{input('eu', 'url', { type: 'url', inputMode: 'url', placeholder: 'https://' })}</Field>
          </>
        )}
        <Field label={f.kind === 'spot' ? 'Petit mot' : 'Présentation'} htmlFor="ed">
          {textarea('ed', 'description', f.kind === 'event' ? 7 : 4, f.kind === 'spot' ? 'Passez si vous êtes dans le coin !' : undefined)}
        </Field>

        <div className="pt-2">
          <div className="text-[15px] font-bold mb-2">Qui le voit dans l'appli ?</div>
          <Chips options={((admin ? ['all', 'some', 'link'] : ['all', 'link']) as Audience[]).map(a => ({ id: a, label: AUDIENCE_LABEL[a] }))} value={f.audience} onChange={a => setF({ ...f, audience: a as Audience })} />
          <p className="text-[13px] mt-2 px-1" style={{ color: C.mute }}>
            {f.audience === 'all' ? 'Tous les comptes CKMoney la voient.' : f.audience === 'some' ? "Seules les personnes cochées la voient dans l'appli." : "Invisible dans l'appli : tu envoies le lien à qui tu veux."}
            {' '}Le lien partagé marche dans tous les cas, même sans compte.
          </p>
        </div>
        {f.audience === 'some' && <PeoplePicker value={f.invitees} onChange={v => setF({ ...f, invitees: v })} />}
        {f.audience !== 'link' && !initial?.notified && (
          <Toggle on={notify} onChange={setNotify} label="Prévenir par notification"
            sub={f.audience === 'all' ? 'Tous ceux qui ont activé les notifications' : `${f.invitees.length} personne${f.invitees.length > 1 ? 's' : ''} choisie${f.invitees.length > 1 ? 's' : ''}`} />
        )}
        {error && <Note tone="danger">{error}</Note>}
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        <Button busy={busy === 'save'} onClick={save}>{initial ? 'Enregistrer' : `Publier ${what}`}</Button>
        {f.id && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Supprimer {what}</Button>}
      </div>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer cette sortie ?">
        <p className="text-[15px] leading-relaxed mb-4" style={{ color: C.text2 }}>« {f.title} » disparaîtra de l'appli et le lien partagé ne marchera plus. Ce n'est pas réversible.</p>
        <div className="flex flex-col gap-2.5">
          <Button variant="danger" busy={busy === 'delete'} onClick={remove}>Supprimer définitivement</Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Annuler</Button>
        </div>
      </Sheet>
    </Screen>
  );
};

/** Pour l'auteur : qui voit la sortie et, pour un chill, qui vient. */
const AuthorPanel: React.FC<{ e: AppEvent }> = ({ e }) => {
  const [people, setPeople] = useState<{ name: string; member: boolean }[] | null>(null);
  useEffect(() => { if (e.kind === 'chill') listRsvps(e.id).then(setPeople).catch(() => setPeople([])); }, [e.id, e.kind]);
  const aud = e.audience || 'all';
  const n = e.invitees?.length || 0;
  return (
    <div className="px-5 pt-5 flex flex-col gap-3">
      {e.kind === 'chill' && (
        <Card>
          <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
            <div className="text-[15px] font-bold">Qui vient{people ? ` (${people.length}${e.capacity ? `/${e.capacity}` : ''})` : ''}</div>
            <div className="text-[12.5px] font-semibold" style={{ color: C.mute }}>Visible par toi seul</div>
          </div>
          {!people && <div className="px-4 pb-4"><Skeleton h={40} /></div>}
          {people && !people.length && <div className="px-4 pb-4 text-[14px]" style={{ color: C.mute }}>Personne n'a encore répondu.</div>}
          {people?.map((p, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-2 text-[15px]" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="font-medium flex-1">{p.name}</span>
              {!p.member && <span className="text-[12px]" style={{ color: C.mute }}>sans compte</span>}
            </div>
          ))}
        </Card>
      )}
      <div className="flex items-center gap-2 text-[13px] px-1" style={{ color: C.mute }}>
        <Icon name={aud === 'link' ? 'lock' : 'users'} size={16} />
        {aud === 'all' ? 'Visible par tous les comptes CKMoney' : aud === 'some' ? `Visible par ${n} personne${n > 1 ? 's' : ''} dans l'appli` : "Invisible dans l'appli : seulement par lien"}
      </div>
    </div>
  );
};

const Detail: React.FC<{ e: AppEvent; admin: boolean; onBack: () => void; onEdit: () => void; onRemoved: () => void }> = ({ e, admin, onBack, onEdit, onRemoved }) => {
  const [remove, setRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const mine = !!e.mine;
  const [going, setGoing] = useState(!!e.meGoing);
  const [placesLeft, setPlacesLeft] = useState(e.placesLeft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = async (g: boolean) => {
    setBusy(true); setError(null);
    try { const r = await rsvp(e.id, g); setGoing(r.going); setPlacesLeft(r.placesLeft); }
    catch (err) { setError((err as Error).message === 'complet' ? "C'est complet." : "Ça n'a pas marché. Réessaie."); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <TopBar onBack={onBack} right={mine ? <button onClick={onEdit} className="text-[15px] font-semibold px-1" style={{ color: C.ochreText }}>Modifier</button> : undefined} />
      <div className="pb-[max(env(safe-area-inset-bottom),28px)]">
        <EventDetail event={{ ...e, placesLeft }} rsvp={!mine && e.kind === 'chill' ? { going, busy, error, onChange: change } : undefined}
          extra={mine ? <AuthorPanel e={e} /> : undefined} />
        {admin && !mine && (
          <div className="px-5 pt-6">
            <button onClick={() => setRemove(true)} className="text-[13.5px] font-semibold underline underline-offset-2" style={{ color: C.red }}>Retirer cette sortie</button>
          </div>
        )}
      </div>
      <Sheet open={remove} onClose={() => setRemove(false)} title="Retirer cette sortie ?">
        <p className="text-[15px] leading-relaxed mb-4" style={{ color: C.text2 }}>« {e.title} »{e.by ? `, publiée par ${e.by},` : ''} disparaîtra de l'appli et son lien ne marchera plus. Ce n'est pas réversible.</p>
        <div className="flex flex-col gap-2.5">
          <Button variant="danger" busy={removing} onClick={async () => { setRemoving(true); try { await deleteEvent(e.id); setRemove(false); onRemoved(); } catch { setRemoving(false); } }}>Retirer définitivement</Button>
          <Button variant="secondary" onClick={() => setRemove(false)}>Annuler</Button>
        </div>
      </Sheet>
    </Screen>
  );
};

const REGION_LABEL: Record<Region, string> = { paris: 'Paris', afrique: 'Afrique', ailleurs: 'Ailleurs' };

const audienceNote = (e: AppEvent) => {
  const parts: string[] = [];
  parts.push('de toi');
  if (e.audience === 'link') parts.push('par lien');
  if (e.audience === 'some') parts.push(`${e.invitees?.length || 0} pers.`);
  if (e.kind === 'chill') parts.push(`${e.going || 0} vien${(e.going || 0) > 1 ? 'nent' : 't'}`);
  return parts.join(' · ') || undefined;
};

const EventsScreen: React.FC<{ isAdmin: boolean; me?: string; onBack: () => void; initialId?: string; prefill?: Partial<EventInput> }> = ({ isAdmin, me = '', onBack, initialId, prefill }) => {
  const [list, setList] = useState<AppEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{ k: 'list' } | { k: 'read'; id: string } | { k: 'edit'; id?: string; prefill?: Partial<EventInput> }>(
    prefill ? { k: 'edit', prefill } : initialId ? { k: 'read', id: initialId } : { k: 'list' });
  const [toast, setToast] = useState<string | null>(null);
  const [region, setRegion] = useState<'tout' | Region>('tout');

  const load = (fresh = false) => listEvents(fresh).then(l => { setList(l); setFailed(false); }).catch(() => { setFailed(true); setList([]); });
  useEffect(() => { load(); }, []);
  const go = (v: typeof view) => { setView(v); window.scrollTo(0, 0); };
  const withToast = (n: React.ReactNode) => <>{n}<Toast text={toast} onDone={() => setToast(null)} /></>;
  const author = firstName(me);

  const groups = useMemo(() => {
    const all = list || [];
    const upcoming = all.filter(e => isUpcoming(e));
    // Filtre Paris / Afrique dès qu'il y a de quoi trier
    const here = new Set(upcoming.map(regionOf));
    const regions = (['paris', 'afrique', 'ailleurs'] as Region[]).filter(r => here.has(r));
    const filter = upcoming.length >= 6 && here.has('paris') && here.has('afrique');
    const keep = (e: AppEvent) => !filter || region === 'tout' || regionOf(e) === region;
    const next = upcoming.filter(e => !isLive(e) && keep(e));
    const months: { label: string; items: AppEvent[] }[] = [];
    next.forEach(e => {
      const label = monthOf(e.startsAt);
      const last = months[months.length - 1];
      if (last?.label === label) last.items.push(e); else months.push({ label, items: [e] });
    });
    return {
      live: upcoming.filter(e => isLive(e) && keep(e)),
      next, months, filter, regions,
      past: all.filter(e => !isUpcoming(e)).reverse().slice(0, 10),
    };
  }, [list, region]);

  if (view.k === 'edit') {
    const e = view.id ? list?.find(x => x.id === view.id && x.mine) : undefined;
    if (view.id && !e) return <Screen><TopBar onBack={() => go({ k: 'list' })} /><div className="px-5"><Skeleton h={300} /></div></Screen>;
    return <Editor initial={e} prefill={view.prefill} me={author} admin={isAdmin} onBack={() => go(view.id ? { k: 'read', id: view.id } : { k: 'list' })}
      onSaved={(id, notified) => {
        load(true);
        setToast(!id ? 'Sortie supprimée' : notified ? `Publié · ${notified} personne${notified > 1 ? 's' : ''} prévenue${notified > 1 ? 's' : ''}` : 'Publié');
        go(id ? { k: 'read', id } : { k: 'list' });
      }} />;
  }

  if (view.k === 'read') {
    const e = list?.find(x => x.id === view.id);
    if (!list) return <Screen><TopBar onBack={() => go({ k: 'list' })} /><div className="px-5 flex flex-col gap-3"><Skeleton h={170} /><Skeleton h={150} /><Skeleton h={56} /></div></Screen>;
    if (e) return withToast(<Detail key={e.id + (e.updatedAt || '')} e={e} admin={isAdmin} onBack={() => go({ k: 'list' })} onEdit={() => go({ k: 'edit', id: e.id })}
      onRemoved={() => { load(true); setToast('Sortie retirée'); go({ k: 'list' }); }} />);
  }

  const section = (title: string, items: AppEvent[], past = false) => items.length > 0 && (
    <>
      <div className="text-[13px] font-semibold mt-2 px-1" style={{ color: C.mute }}>{title}</div>
      <Card>{items.map((e, i) => (
        <div key={e.id} style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
          <EventRow event={e} past={past} note={e.mine ? audienceNote(e) : e.by ? `par ${e.by}` : undefined} onOpen={() => go({ k: 'read', id: e.id })} />
        </div>
      ))}</Card>
    </>
  );

  return withToast(
    <Screen>
      <TopBar onBack={onBack} title="Sorties" />
      <div className="px-6 pt-2 pb-5">
        <h1 className="serif text-[30px] font-semibold leading-tight">Les sorties</h1>
        <p className="text-[15px] leading-relaxed mt-1.5" style={{ color: C.mute }}>Événements, spots et chills. Partage-les à qui tu veux : la page s'ouvre sans compte.</p>
      </div>
      {<div className="px-5 pb-3"><Button onClick={() => go({ k: 'edit' })}><Icon name="plus" size={20} /> Nouvelle sortie</Button></div>}
      <div className="px-5 flex flex-col gap-2 pb-[max(env(safe-area-inset-bottom),28px)]">
        {!list && <><Skeleton h={88} /><Skeleton h={88} /></>}
        {failed && <Note tone="warn">Les sorties n'ont pas pu être chargées. Vérifie ta connexion.</Note>}
        {groups.filter && (
          <div className="pb-2" role="group" aria-label="Où">
            <Chips options={[{ id: 'tout', label: 'Tout' }, ...groups.regions.map(r => ({ id: r, label: REGION_LABEL[r] }))]} value={region} onChange={r => setRegion(r as 'tout' | Region)} />
          </div>
        )}
        {section('En ce moment', groups.live)}
        {groups.months.length > 1 ? groups.months.map(m => <React.Fragment key={m.label}>{section(m.label, m.items)}</React.Fragment>) : section('À venir', groups.next)}
        {list && !failed && !groups.live.length && !groups.next.length && (
          <Card className="px-5 py-8 text-center">
            <div className="text-[15px] font-semibold">Rien de prévu pour l'instant</div>
            <div className="text-sm mt-1" style={{ color: C.mute }}>Ajoute un événement, un spot ou un chill.</div>
          </Card>
        )}
        {section('Tes sorties passées · visibles par toi seul', groups.past, true)}
      </div>
    </Screen>,
  );
};

export default EventsScreen;
