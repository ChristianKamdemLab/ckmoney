import { adminAuth, adminDb, pushToUser, isAllowedLender } from './admin.js';
import { sendMail } from './mail.js';
import { importEvents, SeedEvent, SALONS_2026_2027 } from './salons.js';

// Annonces : une notification et/ou un e-mail envoyés une seule fois, à l'heure prévue.
//  - notification : à tous les appareils inscrits (l'appli installée avec les notifications) ;
//  - e-mail : aux comptes CKMoney dont l'adresse est vérifiée (tous, ou seulement ceux qui n'ont pas
//    les notifications), avec le détail des nouveautés et une invitation à installer l'appli.
// Les annonces sont écrites ici, dans le code : les mettre en ligne passe par une fusion validée par
// Christian. Une annonce peut aussi publier des sorties d'un coup (calendrier de salons), sans
// notification. Déclenchement : GitHub Actions toutes les heures à :30 (.github/workflows/annonces.yml),
// et le cron du matin en secours. Une annonce n'est plus envoyée 6 h après son heure.

const APP = 'https://ck-money.vercel.app';

export interface NewsEmail {
  subject: string;
  intro: string;
  sections: { title: string; text: string; link?: { label: string; url: string } }[];
}
export interface Announcement {
  id: string;
  sendAt: string;
  push?: { title: string; body: string; url: string };
  email?: NewsEmail;
  emailTo?: 'all' | 'no-push' | 'author' | 'others'; // 'author' : essai à Christian seul ; 'others' : tous sauf lui
  events?: SeedEvent[]; // sorties à publier (voir salons.ts)
}

/** L'e-mail des nouveautés de la semaine (sert aussi d'aperçu avant envoi). */
export const NEWS_2026_11_13: NewsEmail = {
  subject: 'Quoi de neuf sur CKMoney : sorties, jeux et articles',
  intro: "CKMoney ne sert plus seulement aux prêts entre proches. Voici ce que tu peux faire dans l'appli depuis cette semaine.",
  sections: [
    {
      title: 'Sorties',
      text: "Partage un événement, dis où tu es ce soir avec un spot, ou organise un chill avec un thème et des boissons. Chacun peut en publier, et tes amis répondent « Je viens », même sans compte. À ne pas manquer : le Salon des Diasporas Africaines, les 4 et 5 décembre à Paris, entrée gratuite.",
      link: { label: 'Voir les sorties', url: `${APP}/?sorties` },
    },
    {
      title: 'Jeux entre amis',
      text: "Jambo (Fap Fap), Baccalauréat et Le Wiseman : chacun joue sur son téléphone, tes amis rejoignent la table avec un lien, sans compte. Les tables portent des noms de légendes du foot et de séries cultes. On joue pour des points, jamais pour de l'argent.",
      link: { label: 'Lancer une partie de Jambo', url: `${APP}/jambo` },
    },
    {
      title: 'Articles',
      text: 'Les textes de Christian, à lire directement dans l’appli.',
      link: { label: 'Lire les articles', url: `${APP}/` },
    },
  ],
};


export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: '2026-11-13-nouveautes',
    sendAt: '2026-11-13T07:30:00.000Z', // 8 h 30 à Paris (envoyée à 8 h 40)
    push: {
      title: 'Du nouveau sur CKMoney',
      body: 'Nouvelle rubrique Sorties : événements, spots et chills à partager. Et les tables de jeu ont maintenant de vrais noms. À découvrir !',
      url: '/?sorties',
    },
  },
  {
    id: '2026-11-13-email-essai',
    sendAt: '2026-11-13T08:30:00.000Z', // essai demandé par Christian vers 9 h 30
    emailTo: 'author',
    email: NEWS_2026_11_13,
  },
  {
    id: '2026-11-13-email-nouveautes',
    sendAt: '2026-11-13T08:45:00.000Z', // essai validé par Christian à 9 h 46 : tous les autres comptes
    emailTo: 'others',
    email: NEWS_2026_11_13,
  },
  {
    id: '2026-11-13-salons',
    sendAt: '2026-11-13T10:30:00.000Z', // calendrier envoyé par Christian à 11 h : salons de Paris et d'Afrique subsaharienne
    events: SALONS_2026_2027,
  },
  {
    id: '2026-11-13-salons-notif',
    sendAt: '2026-11-13T10:40:00.000Z', // une seule notification pour les 32 salons, validée par Christian à 11 h 35
    push: {
      title: '32 salons ajoutés dans Sorties',
      body: "Paris et Afrique : SIREXE, Ambition Africa, Africa CEO Forum, Rétromobile, Japan Expo… Filtre Paris ou Afrique, et ajoute-les à ton agenda.",
      url: '/?sorties',
    },
  },
];

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const renderNewsEmail = (m: NewsEmail, firstName: string) => {
  const hello = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const html = `<!doctype html><html><body style="margin:0;background:#F7F6F2;font-family:Figtree,Arial,sans-serif;color:#1C2551">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="display:inline-block;background:#C98A1E;color:#fff;font-weight:800;border-radius:10px;padding:8px 10px">CK</div>
    <span style="font-weight:800;font-size:18px;margin-left:8px">CK<span style="color:#C98A1E">Money</span></span>
    <div style="background:#fff;border-radius:18px;padding:22px;margin-top:20px">
      <p style="font-size:16px;margin:0 0 6px;font-weight:700">${esc(hello)}</p>
      <p style="font-size:15px;line-height:1.55;color:#3A3E52;margin:0">${esc(m.intro)}</p>
    </div>
    ${m.sections.map(s => `<div style="background:#fff;border-radius:18px;padding:20px 22px;margin-top:12px">
      <h2 style="font-family:Georgia,serif;font-size:20px;margin:0 0 8px">${esc(s.title)}</h2>
      <p style="font-size:15px;line-height:1.55;color:#3A3E52;margin:0">${esc(s.text)}</p>
      ${s.link ? `<p style="margin:12px 0 0"><a href="${esc(s.link.url)}" style="color:#8A5A0B;font-weight:700;text-decoration:none">${esc(s.link.label)} →</a></p>` : ''}
    </div>`).join('')}
    <div style="background:#1C2551;color:#fff;border-radius:18px;padding:22px;margin-top:12px">
      <div style="font-size:17px;font-weight:800">Installe l'appli, active les notifications</div>
      <p style="font-size:14.5px;line-height:1.55;color:rgba(255,255,255,.78);margin:8px 0 16px">Une icône sur ton écran d'accueil, et tu es prévenu(e) des prochaines sorties et nouveautés. Ça prend 30 secondes, l'appli te guide (iPhone ou Android).</p>
      <a href="${APP}/?installer" style="display:inline-block;background:#C98A1E;color:#1C2551;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:12px">Installer CKMoney</a>
    </div>
    <p style="font-size:12px;color:#6B6F80;line-height:1.5;margin-top:16px">Tu reçois cet e-mail parce que tu as un compte CKMoney. Pour ne plus recevoir les nouveautés, réponds simplement « stop ».</p>
  </div></body></html>`;
  const text = [
    hello, '', m.intro, '',
    ...m.sections.flatMap(s => [s.title.toUpperCase(), s.text, ...(s.link ? [`${s.link.label} : ${s.link.url}`] : []), '']),
    "Installe l'appli et active les notifications pour être prévenu(e) des prochaines sorties :", `${APP}/?installer`, '',
    'Tu reçois cet e-mail parce que tu as un compte CKMoney. Pour ne plus recevoir les nouveautés, réponds « stop ».',
  ].join('\n');
  return { subject: m.subject, html, text };
};

const WINDOW = 6 * 3_600_000;
const firstNameOf = (s: unknown) => String(s || '').trim().split(/\s+/)[0].replace(/[<>]/g, '').slice(0, 30);

/** Comptes qui recevront l'e-mail : adresse vérifiée, pas les invités des jeux, pas les comptes désactivés. */
const emailRecipients = async (to: Announcement['emailTo']) => {
  const [list, profiles, tokens] = await Promise.all([
    adminAuth.listUsers(1000), adminDb.collection('profiles').get(), adminDb.collection('pushTokens').get(),
  ]);
  const names = new Map<string, string>(profiles.docs.map((d: any) => [d.id, firstNameOf(d.data().fullName)]));
  const withPush = new Set<string>(tokens.docs.map((d: any) => d.id));
  return list.users
    .filter((u: any) => u.email && u.emailVerified && !u.disabled && (u.providerData || []).length > 0)
    .filter((u: any) => to !== 'no-push' || !withPush.has(u.uid))
    .filter((u: any) => to !== 'author' || isAllowedLender(u.email, true))
    .filter((u: any) => to !== 'others' || !isAllowedLender(u.email, true))
    .map((u: any) => ({ uid: u.uid as string, email: u.email as string, firstName: names.get(u.uid) || firstNameOf(u.displayName) }));
};

/** Envoie les annonces dues et pas encore parties. Renvoie, pour chacune, ce qui est parti. */
export const sendDueAnnouncements = async (now = Date.now(), list = ANNOUNCEMENTS) => {
  const out: Record<string, unknown> = {};
  for (const a of list) {
    const at = Date.parse(a.sendAt);
    if (!(at <= now && now - at < WINDOW)) continue;
    const ref = adminDb.collection('announcementsSent').doc(a.id);
    // Un seul envoi, même si deux déclenchements arrivent en même temps
    const mine = await adminDb.runTransaction(async (tx: any) => {
      if ((await tx.get(ref)).exists) return false;
      tx.set(ref, { startedAt: new Date(now).toISOString() });
      return true;
    });
    if (!mine) { out[a.id] = 'déjà envoyée'; continue; }
    const result: Record<string, number> = {};
    if (a.events) {
      // En cas d'échec, on libère l'annonce pour que le passage suivant réessaie
      try { Object.assign(result, await importEvents(a.events, now)); }
      catch (err) { await ref.delete(); throw err; }
    }
    if (a.push) {
      const uids = (await adminDb.collection('pushTokens').get()).docs.map((d: any) => d.id);
      const sent = await Promise.all(uids.map((u: string) => pushToUser(u, { ...a.push!, tag: `annonce-${a.id}` }).catch(() => 0)));
      result.people = sent.filter((n: number) => n > 0).length;
      result.devices = sent.reduce((s: number, n: number) => s + n, 0);
    }
    if (a.email) {
      let emails = 0;
      for (const r of await emailRecipients(a.emailTo || 'all')) {
        const msg = renderNewsEmail(a.email, r.firstName);
        if (await sendMail({ to: r.email, subject: msg.subject, html: msg.html, text: msg.text })) emails++;
      }
      result.emails = emails;
    }
    await ref.set({ sentAt: new Date().toISOString(), ...result }, { merge: true });
    out[a.id] = a.push && !a.email ? result.people : result;
  }
  return out;
};
