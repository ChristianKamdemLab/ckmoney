import { adminAuth, adminDb, isAllowedLender, pushToUser } from './_lib/admin.js';
import { cleanEvent, cleanName, escapeHtml, icsFor, isUpcoming, summary, AppEvent, KIND_LABEL } from '../utils/events.js';

// /api/events — les sorties : événements (salons…), spots (« je suis au bar X ») et chills organisés
// par l'auteur. Chaque sortie a sa page publique /e/ID ; dans l'appli, l'auteur choisit qui la voit
// (tout le monde, certaines personnes, ou personne : seulement par lien).
//  GET  ?id=ID     fiche publique (JSON), sans compte
//  GET  ?page=ID   la page /e/ID (voir vercel.json) avec les balises d'aperçu (WhatsApp, iMessage…)
//  GET  ?ics=ID    fichier agenda (.ics)
//  POST list                     comptes CKMoney connectés : ce que la personne a le droit de voir
//  POST rsvp {id, going, name?, token?}  « Je viens » à un chill, avec ou sans compte
//  POST save / delete / rsvps / people   réservé à l'auteur
// Les réponses d'un chill ne sont visibles que par l'auteur.

const col = () => adminDb.collection('events');
const cleanId = (v: unknown) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
const MAX_RSVP = 200;

const base = (id: string, d: any): AppEvent => {
  const kind = d.kind === 'spot' || d.kind === 'chill' ? d.kind : 'event';
  const capacity = typeof d.capacity === 'number' ? d.capacity : null;
  const e: AppEvent = {
    id, kind, title: d.title, startsAt: d.startsAt, endsAt: d.endsAt, venue: d.venue || '', address: d.address || '',
    url: d.url || '', price: d.price ?? (kind === 'event' ? 'Gratuit' : ''), organizer: d.organizer || '', description: d.description || '',
    theme: d.theme || '', drinks: d.drinks || '', capacity,
    placesLeft: capacity ? Math.max(0, capacity - (d.goingCount || 0)) : null,
    status: d.status === 'published' ? 'published' : 'draft', updatedAt: d.updatedAt || '',
  };
  // Un spot terminé ne dit plus où l'auteur était
  if (kind === 'spot' && !isUpcoming(e)) Object.assign(e, { venue: '', address: '', description: '' });
  return e;
};
const forAuthor = (id: string, d: any): AppEvent => ({
  ...base(id, d), venue: d.venue || '', address: d.address || '', description: d.description || '',
  audience: d.audience || 'all', invitees: d.invitees || [], going: d.goingCount || 0,
});

const originOf = (req: any) => `https://${String(req.headers['x-forwarded-host'] || req.headers.host || 'ck-money.vercel.app').split(',')[0].trim()}`;

// La page publique compilée (evenement.html), relue une fois par instance : on y glisse les balises d'aperçu.
let shell: { origin: string; html: string } | null = null;
const pageShell = async (origin: string) => {
  if (shell?.origin === origin) return shell.html;
  try {
    const r = await fetch(`${origin}/evenement.html`, { headers: { accept: 'text/html' } });
    const html = r.ok ? await r.text() : '';
    if (!html.includes('<!--og-->')) return null;
    shell = { origin, html };
    return html;
  } catch { return null; }
};

const ogTags = (origin: string, id: string, e: AppEvent | null) => {
  const title = e ? e.title : 'Sortie introuvable';
  const desc = e ? [e.kind === 'event' ? '' : KIND_LABEL[e.kind], summary(e)].filter(Boolean).join(' · ') : 'Cette sortie n’est plus en ligne.';
  return [
    `<title>${escapeHtml(title)} · CKMoney</title>`,
    `<meta name="description" content="${escapeHtml(desc)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="CKMoney">',
    '<meta property="og:locale" content="fr_FR">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(desc)}">`,
    `<meta property="og:url" content="${escapeHtml(`${origin}/e/${id}`)}">`,
    `<meta property="og:image" content="${escapeHtml(`${origin}/og/evenement.png`)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n    ');
};

const sharePage = async (origin: string, id: string, e: AppEvent | null) => {
  const tags = ogTags(origin, id, e);
  const html = await pageShell(origin);
  if (html) return html.replace(/<title>[^<]*<\/title>/, '').replace('<!--og-->', tags);
  // Secours : la page légère qui renvoie vers /evenement?id=…
  const target = `/evenement?id=${encodeURIComponent(id)}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    ${tags}
    <script>location.replace(${JSON.stringify(target)})</script>
</head><body style="font-family:system-ui;padding:24px"><a href="${escapeHtml(target)}">Voir la sortie</a></body></html>`;
};

const loadPublished = async (id: string) => {
  if (!id) return null;
  const snap = await col().doc(id).get();
  const d = snap.exists ? snap.data() : null;
  return d && d.status === 'published' ? d : null;
};

const caller = async (req: any) => {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!t) return null;
  try { return await adminAuth.verifyIdToken(t); } catch { return undefined; }
};

/** Prévient par notification les personnes qui voient la sortie dans l'appli. */
const notify = async (id: string, e: AppEvent & { audience?: string; invitees?: string[] }, authorUid: string) => {
  if (e.audience === 'link') return 0;
  const uids = e.audience === 'some' ? e.invitees || [] : (await adminDb.collection('pushTokens').get()).docs.map((d: any) => d.id);
  const when = summary({ ...e, price: '' });
  const msg = e.kind === 'spot' ? { title: e.title, body: [e.venue, when].filter(Boolean).join(' · ') }
    : e.kind === 'chill' ? { title: `Chill : ${e.title}`, body: `${when} · Dis si tu viens` }
    : { title: e.title, body: summary(e) };
  const targets = [...new Set(uids)].filter(u => u && u !== authorUid);
  const sent = await Promise.all(targets.map(u => pushToUser(u, { ...msg, url: `/?evenement=${id}`, tag: `sortie-${id}` }).catch(() => 0)));
  return sent.filter(n => n > 0).length;
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const q = req.query || {};
      if (q.page !== undefined) {
        const id = cleanId(q.page);
        const d = await loadPublished(id);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=120');
        return res.status(d ? 200 : 404).send(await sharePage(originOf(req), id, d ? base(id, d) : null));
      }
      if (q.ics !== undefined) {
        const id = cleanId(q.ics);
        const d = await loadPublished(id);
        if (!d) return res.status(404).send('introuvable');
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="sortie.ics"');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=120');
        return res.status(200).send(icsFor(base(id, d), `${originOf(req)}/e/${id}`));
      }
      const id = cleanId(q.id);
      const d = await loadPublished(id);
      if (!d) return res.status(404).json({ error: 'introuvable' });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(base(id, d));
    }

    if (req.method !== 'POST') return res.status(405).end();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const who = await caller(req);
    if (who === undefined) return res.status(401).json({ error: 'unauthorized' });
    const member = !!who && who.firebase?.sign_in_provider !== 'anonymous';

    // « Je viens » à un chill : compte CKMoney, ou prénom + jeton gardé par le navigateur
    if (body.action === 'rsvp') {
      const id = cleanId(body.id);
      const token = String(body.token || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
      const key = member ? who.uid : token.length >= 16 ? `g_${token}` : '';
      const name = cleanName(body.name);
      if (!key) return res.status(400).json({ error: 'token' });
      if (!member && body.going && !name) return res.status(400).json({ error: 'name' });
      const ref = col().doc(id);
      const rref = ref.collection('rsvps').doc(key);
      const out = await adminDb.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        const d = snap.exists ? snap.data() : null;
        if (!d || d.status !== 'published' || d.kind !== 'chill' || !isUpcoming(d)) return { error: 'introuvable', status: 404 };
        const had = (await tx.get(rref)).exists;
        let count = d.goingCount || 0;
        if (body.going && !had) {
          if (d.capacity && count >= d.capacity) return { error: 'complet', status: 409 };
          if (count >= MAX_RSVP) return { error: 'complet', status: 409 };
          let display = name;
          if (member) {
            const p = (await tx.get(adminDb.collection('profiles').doc(who.uid))).data();
            display = cleanName(p?.fullName) || cleanName(who.name) || name || 'Un membre';
          }
          tx.set(rref, { name: display, at: new Date().toISOString(), member });
          count += 1;
        } else if (!body.going && had) {
          tx.delete(rref);
          count = Math.max(0, count - 1);
        }
        tx.update(ref, { goingCount: count });
        return { going: !!body.going, placesLeft: d.capacity ? Math.max(0, d.capacity - count) : null };
      });
      if ('error' in out) return res.status(out.status).json({ error: out.error });
      return res.status(200).json(out);
    }

    if (!who) return res.status(401).json({ error: 'unauthorized' });
    const author = isAllowedLender(who.email, who.email_verified === true);

    if (body.action === 'list') {
      // Les invités des jeux (comptes anonymes) n'ont pas accès à la liste
      if (!member) return res.status(403).json({ error: 'forbidden' });
      const snap = await col().where('status', '==', 'published').get();
      const visible = snap.docs.filter((doc: any) => {
        const d = doc.data();
        if (author) return true;
        if (!isUpcoming(d)) return false;
        const aud = d.audience || 'all';
        return aud === 'all' || (aud === 'some' && (d.invitees || []).includes(who.uid));
      });
      const events = await Promise.all(visible.map(async (doc: any) => {
        const d = doc.data();
        const e = author ? forAuthor(doc.id, d) : base(doc.id, d);
        if (e.kind === 'chill') e.meGoing = (await col().doc(doc.id).collection('rsvps').doc(who.uid).get()).exists;
        return e;
      }));
      events.sort((a: AppEvent, b: AppEvent) => a.startsAt.localeCompare(b.startsAt));
      return res.status(200).json({ events });
    }

    if (!author) return res.status(403).json({ error: 'not_author' });
    const now = new Date().toISOString();

    if (body.action === 'save') {
      const e = cleanEvent(body.event);
      if (!e) return res.status(400).json({ error: 'invalid' });
      const id = cleanId(body.event?.id);
      const ref = id ? col().doc(id) : col().doc();
      if (id) {
        const prev = (await ref.get()).data();
        if (!prev || prev.authorUid !== who.uid) return res.status(403).json({ error: 'forbidden' });
      }
      await ref.set({ ...e, status: 'published', authorUid: who.uid, updatedAt: now, ...(id ? {} : { createdAt: now, goingCount: 0 }) }, { merge: true });
      const notified = body.notify ? await notify(ref.id, { id: ref.id, status: 'published', ...e }, who.uid) : 0;
      return res.status(200).json({ id: ref.id, notified });
    }

    const ref = col().doc(cleanId(body.id));
    if (body.action === 'delete' || body.action === 'rsvps') {
      const prev = (await ref.get()).data();
      if (!prev || prev.authorUid !== who.uid) return res.status(404).json({ error: 'introuvable' });
      if (body.action === 'delete') {
        await adminDb.recursiveDelete(ref);
        return res.status(200).json({ ok: true });
      }
      const snap = await ref.collection('rsvps').get();
      const people = snap.docs.map((d: any) => ({ name: d.data().name, at: d.data().at, member: !!d.data().member }))
        .sort((a: any, b: any) => String(a.at).localeCompare(String(b.at)));
      return res.status(200).json({ people });
    }

    // Les comptes CKMoney, pour choisir qui voit une sortie (prénoms seulement)
    if (body.action === 'people') {
      const [list, profiles] = await Promise.all([adminAuth.listUsers(1000), adminDb.collection('profiles').get()]);
      const names = new Map<string, string>(profiles.docs.map((d: any) => [d.id, cleanName(d.data().fullName)]));
      const people = list.users
        .filter((u: any) => u.uid !== who.uid && !u.disabled && (u.providerData || []).length > 0)
        .map((u: any) => ({ uid: u.uid, name: names.get(u.uid) || cleanName(u.displayName) || cleanName((u.email || '').split('@')[0]) || 'Sans nom' }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));
      return res.status(200).json({ people });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e: any) {
    console.error('events', e?.message);
    return res.status(500).json({ error: 'erreur' });
  }
}
