import { adminAuth, adminDb, isAllowedLender } from './_lib/admin.js';
import { cleanEvent, escapeHtml, icsFor, isUpcoming, shortWhen, AppEvent } from '../utils/events.js';

// /api/events — les rendez-vous à venir (salons, sorties…). Aucune liste de participants n'est tenue.
//  GET  ?id=ID     fiche publique (JSON) : la page /e/ID s'ouvre sans compte
//  GET  ?page=ID   la page /e/ID elle-même (voir vercel.json), avec les balises d'aperçu (WhatsApp,
//                  iMessage, réseaux) : titre, date, lieu, prix
//  GET  ?ics=ID    fichier agenda (.ics) pour l'iPhone, Android ou Outlook
//  POST            { action: 'list' } : comptes CKMoney connectés (pas les invités des jeux)
//                  { action: 'save', event } / { action: 'delete', id } : réservé à l'auteur

const col = () => adminDb.collection('events');
const cleanId = (v: unknown) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
const toEvent = (id: string, d: any): AppEvent => ({
  id, title: d.title, startsAt: d.startsAt, endsAt: d.endsAt, venue: d.venue || '', address: d.address || '',
  url: d.url || '', price: d.price || 'Gratuit', organizer: d.organizer || '', description: d.description || '',
  status: d.status === 'published' ? 'published' : 'draft', updatedAt: d.updatedAt || '',
});

const originOf = (req: any) => `https://${String(req.headers['x-forwarded-host'] || req.headers.host || 'ck-money.vercel.app').split(',')[0].trim()}`;

// La page publique compilée (evenement.html), relue une fois par instance : on y glisse les balises d'aperçu.
let shell: { origin: string; html: string } | null = null;
const pageShell = async (origin: string) => {
  if (shell?.origin === origin) return shell.html;
  try {
    const r = await fetch(`${origin}/evenement.html`, { headers: { 'x-ckmoney-shell': '1' } });
    const html = r.ok ? await r.text() : '';
    if (!html.includes('<!--og-->')) return null;
    shell = { origin, html };
    return html;
  } catch { return null; }
};

const ogTags = (origin: string, id: string, e: AppEvent | null) => {
  const title = e ? e.title : 'Événement introuvable';
  const desc = e ? [shortWhen(e), e.venue, e.price].filter(Boolean).join(' · ') : 'Cet événement n’est plus en ligne.';
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
</head><body style="font-family:system-ui;padding:24px"><a href="${escapeHtml(target)}">Voir l’événement</a></body></html>`;
};

const published = async (id: string) => {
  if (!id) return null;
  const snap = await col().doc(id).get();
  const d = snap.exists ? snap.data() : null;
  return d && d.status === 'published' ? toEvent(id, d) : null;
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const q = req.query || {};
      if (q.page !== undefined) {
        const id = cleanId(q.page);
        const e = await published(id);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
        return res.status(e ? 200 : 404).send(await sharePage(originOf(req), id, e));
      }
      if (q.ics !== undefined) {
        const id = cleanId(q.ics);
        const e = await published(id);
        if (!e) return res.status(404).send('introuvable');
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="evenement.ics"');
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
        return res.status(200).send(icsFor(e, `${originOf(req)}/e/${id}`));
      }
      const e = await published(cleanId(q.id));
      if (!e) return res.status(404).json({ error: 'introuvable' });
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
      return res.status(200).json(e);
    }

    if (req.method !== 'POST') return res.status(405).end();
    let caller: any;
    try { caller = await adminAuth.verifyIdToken((req.headers.authorization || '').replace(/^Bearer /, '')); }
    catch { return res.status(401).json({ error: 'unauthorized' }); }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const author = isAllowedLender(caller.email, caller.email_verified === true);

    if (body.action === 'list') {
      // Les invités des jeux (comptes anonymes) n'ont pas accès à la liste
      if (caller.firebase?.sign_in_provider === 'anonymous') return res.status(403).json({ error: 'forbidden' });
      const snap = await col().where('status', '==', 'published').get();
      const events = snap.docs.map((d: any) => toEvent(d.id, d.data()))
        .filter((e: AppEvent) => author || isUpcoming(e))
        .sort((a: AppEvent, b: AppEvent) => a.startsAt.localeCompare(b.startsAt));
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
        if (!prev || prev.authorUid !== caller.uid) return res.status(403).json({ error: 'forbidden' });
      }
      await ref.set({ ...e, status: 'published', authorUid: caller.uid, updatedAt: now, ...(id ? {} : { createdAt: now }) }, { merge: true });
      return res.status(200).json({ id: ref.id });
    }
    if (body.action === 'delete') {
      const ref = col().doc(cleanId(body.id));
      const prev = (await ref.get()).data();
      if (!prev || prev.authorUid !== caller.uid) return res.status(404).json({ error: 'introuvable' });
      await ref.delete();
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e: any) {
    console.error('events', e?.message);
    return res.status(500).json({ error: 'erreur' });
  }
}
