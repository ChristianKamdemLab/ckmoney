import React, { useEffect, useState } from 'react';
import { Screen, TopBar, Button, Card, Note, Sheet, Toast, Skeleton, Field, inputClass, inputStyle, Icon, C } from './ui';
import { EventDetail, EventRow } from './EventView';
import { listEvents, saveEvent, deleteEvent } from '../../services/eventService';
import { AppEvent, EventInput, isUpcoming, toLocalInput, fromLocalInput } from '../../utils/events';

// Événements à venir (salons, sorties…) : tout compte connecté les voit, l'auteur les ajoute.
// Chaque événement a sa page publique (/e/ID) à partager hors de l'appli.

type Form = Omit<EventInput, 'startsAt' | 'endsAt'> & { start: string; end: string };

const emptyForm: Form = { title: '', start: '', end: '', venue: '', address: '', url: '', price: 'Gratuit', organizer: '', description: '' };

const Editor: React.FC<{ initial?: AppEvent; onBack: () => void; onSaved: (id?: string) => void }> = ({ initial, onBack, onSaved }) => {
  const [f, setF] = useState<Form>(() => initial
    ? { id: initial.id, title: initial.title, start: toLocalInput(initial.startsAt), end: toLocalInput(initial.endsAt), venue: initial.venue, address: initial.address, url: initial.url, price: initial.price, organizer: initial.organizer, description: initial.description }
    : emptyForm);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof Form) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: ev.target.value });

  const save = async () => {
    const startsAt = fromLocalInput(f.start);
    const endsAt = fromLocalInput(f.end) || startsAt;
    if (!f.title.trim() || !startsAt) { setError('Il faut au moins un titre et une date de début.'); return; }
    if (endsAt < startsAt) { setError('La fin doit venir après le début.'); return; }
    if (f.url && !/^https?:\/\//i.test(f.url.trim())) { setError('Le lien doit commencer par https://'); return; }
    setBusy('save'); setError(null);
    try {
      const { start, end, ...rest } = f;
      onSaved(await saveEvent({ ...rest, url: rest.url.trim(), startsAt, endsAt }));
    } catch (e) {
      setError((e as Error).message === 'not_author' ? "Seul l'auteur peut publier un événement." : "L'enregistrement a échoué. Réessaie.");
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

  return (
    <Screen>
      <TopBar onBack={onBack} title={initial ? "Modifier l'événement" : 'Nouvel événement'} />
      <div className="px-5 pt-2 flex flex-col gap-4">
        <Field label="Titre" htmlFor="et">{input('et', 'title', { placeholder: 'Salon, concert, sortie…' })}</Field>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Début" htmlFor="es">{input('es', 'start', { type: 'datetime-local' })}</Field>
          <Field label="Fin" htmlFor="ee" hint="Vide : même heure que le début.">{input('ee', 'end', { type: 'datetime-local', min: f.start || undefined })}</Field>
        </div>
        <Field label="Lieu" htmlFor="ev">{input('ev', 'venue', { placeholder: 'Palais de la Porte Dorée' })}</Field>
        <Field label="Adresse" htmlFor="ea" hint="Sert à l'itinéraire.">{input('ea', 'address', { placeholder: '293 avenue Daumesnil, 75012 Paris' })}</Field>
        <Field label="Prix" htmlFor="ep">{input('ep', 'price', { placeholder: 'Gratuit' })}</Field>
        <Field label="Organisateur" htmlFor="eo">{input('eo', 'organizer')}</Field>
        <Field label="Lien de réservation" htmlFor="eu" hint="La billetterie ou la page officielle.">{input('eu', 'url', { type: 'url', inputMode: 'url', placeholder: 'https://' })}</Field>
        <Field label="Présentation" htmlFor="ed">
          <textarea id="ed" value={f.description} onChange={set('description')} rows={7}
            className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none border-[1.5px] focus:border-[#1C2551]" style={inputStyle} />
        </Field>
        {error && <Note tone="danger">{error}</Note>}
      </div>
      <div className="mt-auto px-5 pt-6 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        <Button busy={busy === 'save'} onClick={save}>{initial ? 'Enregistrer' : "Publier l'événement"}</Button>
        {f.id && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Supprimer l'événement</Button>}
      </div>
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer cet événement ?">
        <p className="text-[15px] leading-relaxed mb-4" style={{ color: C.text2 }}>« {f.title} » disparaîtra de l'appli et le lien partagé ne marchera plus. Ce n'est pas réversible.</p>
        <div className="flex flex-col gap-2.5">
          <Button variant="danger" busy={busy === 'delete'} onClick={remove}>Supprimer définitivement</Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Annuler</Button>
        </div>
      </Sheet>
    </Screen>
  );
};

const EventsScreen: React.FC<{ isAuthor: boolean; onBack: () => void; initialId?: string }> = ({ isAuthor, onBack, initialId }) => {
  const [list, setList] = useState<AppEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{ k: 'list' } | { k: 'read'; id: string } | { k: 'edit'; id?: string }>(initialId ? { k: 'read', id: initialId } : { k: 'list' });
  const [toast, setToast] = useState<string | null>(null);

  const load = (fresh = false) => listEvents(fresh).then(l => { setList(l); setFailed(false); }).catch(() => { setFailed(true); setList([]); });
  useEffect(() => { load(); }, []);
  const go = (v: typeof view) => { setView(v); window.scrollTo(0, 0); };
  const withToast = (n: React.ReactNode) => <>{n}<Toast text={toast} onDone={() => setToast(null)} /></>;

  if (view.k === 'edit' && isAuthor) {
    const e = view.id ? list?.find(x => x.id === view.id) : undefined;
    return <Editor initial={e} onBack={() => go(view.id ? { k: 'read', id: view.id } : { k: 'list' })}
      onSaved={id => { load(true); setToast(id ? 'Événement publié' : 'Événement supprimé'); go(id ? { k: 'read', id } : { k: 'list' }); }} />;
  }

  if (view.k === 'read') {
    const e = list?.find(x => x.id === view.id);
    if (!list) return <Screen><TopBar onBack={() => go({ k: 'list' })} /><div className="px-5 flex flex-col gap-3"><Skeleton h={170} /><Skeleton h={150} /><Skeleton h={56} /></div></Screen>;
    if (e) return withToast(
      <Screen>
        <TopBar onBack={() => go({ k: 'list' })} right={isAuthor ? <button onClick={() => go({ k: 'edit', id: e.id })} className="text-[15px] font-semibold px-1" style={{ color: C.ochreText }}>Modifier</button> : undefined} />
        <div className="pb-[max(env(safe-area-inset-bottom),28px)]"><EventDetail event={e} /></div>
      </Screen>,
    );
  }

  const upcoming = (list || []).filter(e => isUpcoming(e));
  const past = (list || []).filter(e => !isUpcoming(e)).reverse();
  return withToast(
    <Screen>
      <TopBar onBack={onBack} title="Événements" />
      <div className="px-6 pt-2 pb-5">
        <h1 className="serif text-[30px] font-semibold leading-tight">Les rendez-vous à venir</h1>
        <p className="text-[15px] leading-relaxed mt-1.5" style={{ color: C.mute }}>Salons, sorties et soirées à ne pas manquer. Partage-les à qui tu veux : la page s'ouvre sans compte.</p>
      </div>
      {isAuthor && <div className="px-5 pb-5"><Button onClick={() => go({ k: 'edit' })}><Icon name="plus" size={20} /> Ajouter un événement</Button></div>}
      <div className="px-5 flex flex-col gap-3 pb-[max(env(safe-area-inset-bottom),28px)]">
        {!list && <><Skeleton h={88} /><Skeleton h={88} /></>}
        {failed && <Note tone="warn">Les événements n'ont pas pu être chargés. Vérifie ta connexion.</Note>}
        {upcoming.length > 0 && (
          <Card>{upcoming.map((e, i) => <div key={e.id} style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}><EventRow event={e} onOpen={() => go({ k: 'read', id: e.id })} /></div>)}</Card>
        )}
        {list && !failed && !upcoming.length && (
          <Card className="px-5 py-8 text-center">
            <div className="text-[15px] font-semibold">Aucun rendez-vous pour l'instant</div>
            <div className="text-sm mt-1" style={{ color: C.mute }}>{isAuthor ? 'Ajoute le prochain salon ou la prochaine sortie.' : 'Les prochains événements apparaîtront ici.'}</div>
          </Card>
        )}
        {isAuthor && past.length > 0 && (
          <>
            <div className="text-[13px] font-semibold mt-3 px-1" style={{ color: C.mute }}>Passés · masqués pour les autres</div>
            <Card>{past.map((e, i) => <div key={e.id} style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}><EventRow event={e} past onOpen={() => go({ k: 'read', id: e.id })} /></div>)}</Card>
          </>
        )}
      </div>
    </Screen>,
  );
};

export default EventsScreen;
