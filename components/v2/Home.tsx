import React, { useEffect, useMemo, useState } from 'react';
import { Article, Loan, Notification, Profile, User } from '../../types';
import { C, Icon, IconName, Avatar, Card, Screen, TopBar, Button, Note, firstName, dateFr, MainTab } from './ui';
import CKLogo from '../brand/CKLogo';
import PushCard from './PushCard';
import FiscalPanel from '../FiscalPanel';
import { InstallCard, InstallButton } from './Install';
import { InviteCard, MotTile } from './Discover';
import VendrediShow from './VendrediShow';
import { listArticles } from '../../services/articleService';
import { listInfo } from '../../services/infoService';
import { listDecryptage, DecryptageDay, playDecryptage, decryptageTrackId } from '../../services/decryptageService';
import { listFilms } from '../../services/filmService';
import { listEvents } from '../../services/eventService';
import { usePlayer } from '../../services/player';
import { getUserNotifications, markNotificationAsRead } from '../../services/notificationService';
import { AppEvent, sortUpcoming, isLive, dayBlock } from '../../utils/events';
import { Film, trailerImage, KIND_LABEL as FILM_KIND } from '../../utils/films';
import { InfoDay, InfoScope } from '../../utils/infoDuJour';
import { frTypo } from '../../utils/articleText';
import type { Zone as RZone } from '../../utils/rubrique';
import { dayNumber, puzzleFor, isOver, isWon, MAX_TRIES } from '../../games/mot';
import { computeSituation } from '../../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../../config/legal';

// Nouvelle interface (26/11, maquette validée par Christian) : Accueil, Actu, Entre amis, l'activité
// (la cloche) et le profil d'un proche qui ne prête pas. Les onglets Prêts et le profil du prêteur
// restent dans LenderTabs et FriendFlows.

export interface Nav {
  onTab: (t: MainTab) => void;
  onActivity: () => void;
  onArticles: (id?: string) => void;
  onInfo: (scope?: InfoScope | 'decryptage') => void;
  onEvents: (id?: string) => void;
  onMot: () => void; onJambo: () => void; onBac: () => void; onWiseman: () => void;
  onRadio: () => void; onVendredi: () => void; onAdresses: () => void; onFilms: () => void;
}

const parisDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
const yesterday = () => parisDay(new Date(Date.now() - 86_400_000));

/** « Aujourd'hui », « Hier », sinon « lundi 23 ». */
const dayLabel = (iso: string) => {
  const d = iso.slice(0, 10);
  if (d === parisDay()) return "Aujourd'hui";
  if (d === yesterday()) return 'Hier';
  return dateFr(d, { weekday: 'long', day: 'numeric' });
};

const useLoad = <T,>(f: () => Promise<T>, init: T): T => useCached(f, init)[0];

/** Chargement avec la dernière version gardée sur le téléphone (27/11) : l'écran s'affiche tout de suite
 *  à sa taille finale, puis se met à jour ; plus de « saut » quand les données arrivent. */
const useCached = <T,>(f: () => Promise<T>, init: T, key?: string, slim?: (v: T) => T): [T, boolean] => {
  const [v, setV] = useState<T>(() => { if (!key) return init; try { const c = localStorage.getItem(`ck_c_${key}`); return c ? JSON.parse(c) : init; } catch { return init; } });
  const [ready, setReady] = useState(() => { try { return !!key && localStorage.getItem(`ck_c_${key}`) !== null; } catch { return false; } });
  useEffect(() => {
    let on = true;
    f().then(x => {
      if (!on) return;
      setV(x); setReady(true);
      if (key) try { localStorage.setItem(`ck_c_${key}`, JSON.stringify(slim ? slim(x) : x)); } catch { /* stockage plein ou indisponible */ }
    }).catch(() => on && setReady(true));
    return () => { on = false; };
  }, []);
  return [v, ready];
};
const slimArticles = (l: Article[]) => l.filter(a => a.status === 'published').map(a => ({ id: a.id, kind: a.kind, status: a.status, title: a.title, readMinutes: a.readMinutes, publishedAt: a.publishedAt, updatedAt: a.updatedAt, source: a.source, excerpt: '', body: '', summary: '' } as any));

const useUnread = (uid: string) => {
  const [n, setN] = useState(0);
  useEffect(() => { let on = true; getUserNotifications(uid).then(l => on && setN(l.filter(x => !x.read).length)).catch(() => undefined); return () => { on = false; }; }, [uid]);
  return n;
};

const Section: React.FC<{ title: string; action?: string; onAction?: () => void }> = ({ title, action, onAction }) => (
  <div className="px-5 pt-7 pb-3 flex items-baseline justify-between">
    <h2 className="text-[18px] font-extrabold">{title}</h2>
    {action && onAction && <button onClick={onAction} className="text-[14px] font-bold" style={{ color: C.ochreText }}>{action}</button>}
  </div>
);

const Rail: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-3 overflow-x-auto px-5 pb-1" style={{ scrollbarWidth: 'none' }}>{children}</div>
);

// Couverture des textes CKLabs : la nuit et la mangue de l'appli (pas d'image : une composition)
const CK_COVER = { bg: C.night, fg: '#F7F3EA', tag: C.mango, deco: (<span aria-hidden="true" className="absolute rounded-full" style={{ width: 64, height: 64, background: C.mango, top: -22, right: -18 }} />) };

// Revue de presse (27/11) : une couleur par rubrique, pour donner envie et repérer d'un coup d'œil
const ZONE_COVER: Record<string, { bg: string; fg: string; tag: string; dot: string }> = {
  cameroun: { bg: C.teal, fg: C.ink, tag: C.ink, dot: C.night },
  afrique: { bg: C.mango, fg: C.ink, tag: C.ochreText, dot: C.coral },
  monde: { bg: C.coral, fg: C.ink, tag: C.ink, dot: C.mango },
  eco: { bg: C.green, fg: '#fff', tag: C.mango, dot: C.mango },
};
const ZONE_NAME: Record<string, string> = { cameroun: 'Cameroun', afrique: 'Afrique', monde: 'Monde', eco: 'Éco' };
const pressCover = (zones: string[]) => {
  const z = zones.find(x => x !== 'eco' && ZONE_COVER[x]) || (zones.includes('eco') ? 'eco' : 'monde');
  const c = ZONE_COVER[z];
  return { ...c, label: ZONE_NAME[z], deco: (<span aria-hidden="true" className="absolute rounded-full" style={{ width: 52, height: 52, background: c.dot, top: -20, right: -16 }} />) };
};

const motLine = () => {
  const n = dayNumber(), p = puzzleFor(n);
  let h: Record<string, string[]> = {};
  try { h = JSON.parse(localStorage.getItem('ck_mot') || '{}').h || {}; } catch { /* stockage indisponible */ }
  const g = h[n] || [];
  if (isOver(g, p.word)) return isWon(g, p.word) ? `Trouvé en ${g.length}/${MAX_TRIES}` : 'Raté, à demain';
  return g.length ? `${g.length}/${MAX_TRIES} essais · à finir` : 'À toi de jouer';
};

/** Ce qui demande une action dans les prêts : une ligne en haut de l'accueil. */
const loanAlert = (loans: Loan[], uid: string, isLender: boolean): string | null => {
  const mineL = loans.filter(l => l.lenderUid === uid);
  const toHandle = mineL.filter(l => l.status === 'requested' || l.status === 'delay_requested' || (l.payments || []).some(p => p.status === 'declared')).length;
  const late = mineL.filter(l => ['active', 'delay_requested'].includes(l.status) && computeSituation(l, LEGAL_INTEREST_RATE).isOverdue).length;
  const parts: string[] = [];
  if (isLender && toHandle) parts.push(`${toHandle} à traiter`);
  if (isLender && late) parts.push(`${late} en retard`);
  const borrowed = loans.filter(l => l.borrowerUid === uid && ['active', 'delay_requested', 'pending_borrower'].includes(l.status));
  if (borrowed.some(l => l.status === 'pending_borrower')) parts.push('un contrat à signer');
  const dueSoon = borrowed.map(l => computeSituation(l, LEGAL_INTEREST_RATE)).find(s => s.isOverdue || (s.nextInstallment && s.nextInstallment.dueDate <= parisDay(new Date(Date.now() + 2 * 86_400_000))));
  if (dueSoon) parts.push(dueSoon.isOverdue ? 'un remboursement en retard' : 'un remboursement à faire bientôt');
  return parts.length ? parts.join(' · ') : null;
};

// ───────────────────────── Accueil ─────────────────────────

export const HomeTab: React.FC<{ user: User; profile: Profile | null; loans: Loan[]; isLender: boolean; nav: Nav }> = ({ user, profile, loans, isLender, nav }) => {
  const unread = useUnread(user.id);
  const [decs, decReady] = useCached(listDecryptage, [] as DecryptageDay[], 'decs', l => l.slice(0, 2).map(d => ({ ...d, lines: [] })));
  const [info, infoReady] = useCached(listInfo, [] as InfoDay[], 'info', l => l.slice(0, 1));
  const [articles] = useCached(() => listArticles(user.id, false), [] as Article[], 'articles', slimArticles);
  const [films] = useCached(() => listFilms().then(r => r.films), [] as Film[], 'films', l => l.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 10));
  const ps = usePlayer();

  const dec = decs.find(d => d.date >= yesterday()) || null;
  const day = info[0];
  // Les articles (27/11) : tous les textes CKLabs (ils restent) et la revue de presse récente, du plus récent au plus ancien
  const own = [...articles.filter(a => a.status === 'published' && a.kind !== 'press'), ...articles.filter(a => a.status === 'published' && a.kind === 'press').slice(0, 8)]
    .sort((a, b) => (b.publishedAt || b.updatedAt || '').localeCompare(a.publishedAt || a.updatedAt || ''));
  const recos = films.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 10);
  const alert = loanAlert(loans, user.id, isLender);
  const name = firstName(profile?.fullName || user.name);
  const decPlaying = !!dec && ps.track?.id === decryptageTrackId(dec.date) && (ps.playing || ps.loading);

  return (
    <Screen bottomPad>
      <div className="px-5 pt-[max(env(safe-area-inset-top),18px)] pb-2 flex items-center justify-between">
        <button onClick={nav.onActivity} aria-label={unread ? `Notifications, ${unread} nouvelles` : 'Notifications'} className="relative w-11 h-11 rounded-full flex items-center justify-center" style={{ background: C.card, color: C.ink }}>
          <Icon name="bell" size={21} />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-extrabold flex items-center justify-center" style={{ background: C.coral, color: '#fff' }}>{unread > 9 ? '9+' : unread}</span>}
        </button>
        <CKLogo size="sm" />
        <button onClick={() => nav.onTab('profile')} aria-label="Mon profil" className="rounded-full"><Avatar name={profile?.fullName || user.name} size={44} /></button>
      </div>

      <div className="px-5">
        <div className="text-[13px] font-bold capitalize" style={{ color: C.mute }}>{dateFr(parisDay(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 className="display text-[24px] leading-tight mt-0.5 mb-3.5">Bonjour {name}</h1>

        {alert && (
          <button onClick={() => nav.onTab('loans')} className="w-full mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 text-left" style={{ background: C.redSoft, color: C.red }}>
            <Icon name="alert" size={20} />
            <span className="flex-1 text-[14px] font-bold">Prêts : {alert}</span>
            <Icon name="chevron" size={18} />
          </button>
        )}

        {dec ? (
          // Carte compacte (26/11, retour de Christian : l'ancienne prenait tout l'écran) : deux lignes de titre, lecture à droite
          <div className="relative overflow-hidden rounded-[20px] pl-4 pr-3 py-3.5 flex items-center gap-3" style={{ background: C.night, color: C.nightText }}>
            <span aria-hidden="true" className="absolute rounded-full" style={{ width: 96, height: 96, background: C.mango, top: -58, right: -34 }} />
            <button onClick={() => nav.onInfo('decryptage')} className="relative z-[1] flex-1 min-w-0 text-left">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.coral }} /><span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: C.mango }}>{dec.date === parisDay() ? 'Le décryptage du jour' : "Le décryptage d'hier"} · {dec.minutes} min</span></span>
              <span className="block mt-1 text-[15.5px] leading-[1.3] font-extrabold line-clamp-2">{frTypo(dec.title)}</span>
            </button>
            <button onClick={() => playDecryptage(dec, () => nav.onInfo('decryptage'))} aria-label={decPlaying && ps.playing ? 'Pause' : 'Écouter le décryptage'}
              className="relative z-[1] w-[52px] h-[52px] rounded-full shrink-0 flex items-center justify-center" style={{ background: C.mango, color: C.ink, boxShadow: `0 0 0 4px ${C.night}` }}>
              {decPlaying && ps.loading ? <span className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(14,21,51,.25)', borderTopColor: C.ink }} />
                : decPlaying && ps.playing ? <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" /><rect x="11.5" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" /></svg>
                : <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3.2v13.6L16.5 10z" fill="currentColor" /></svg>}
            </button>
          </div>
        ) : day?.items[0] ? (
          <button onClick={() => nav.onInfo(day.items[0].scope)} className="relative overflow-hidden w-full text-left rounded-[20px] px-4 py-3.5" style={{ background: C.night, color: C.nightText }}>
            <span aria-hidden="true" className="absolute rounded-full" style={{ width: 96, height: 96, background: C.mango, top: -58, right: -34 }} />
            <span className="relative z-[1] text-[11px] font-extrabold uppercase tracking-wide" style={{ color: C.mango }}>L'info du jour</span>
            <span className="relative z-[1] block mt-1 mr-8 text-[15.5px] leading-[1.3] font-extrabold line-clamp-2">{frTypo(day.items[0].title)}</span>
          </button>
        ) : !(decReady && infoReady) ? <div className="h-[82px] rounded-[20px] animate-pulse" style={{ background: C.soft }} /> : null}

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <button onClick={nav.onMot} className="rounded-2xl px-3 py-3 flex items-center gap-2.5 text-left" style={{ background: C.card }}>
            <span className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center display text-[12px]" style={{ background: C.ochreSoft, color: C.ochreText }}>M</span>
            <span className="min-w-0"><span className="block text-[12.5px] whitespace-nowrap" style={{ color: C.mute }}>Le mot du jour</span><span className="block text-[14px] font-extrabold leading-[1.3]">{motLine()}</span></span>
          </button>
          <button onClick={() => nav.onInfo()} className="rounded-2xl px-3 py-3 flex items-center gap-2.5 text-left" style={{ background: C.card }}>
            <span className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center" style={{ background: C.greenSoft, color: C.green }}><Icon name="news" size={17} /></span>
            <span className="min-w-0"><span className="block text-[12.5px] whitespace-nowrap" style={{ color: C.mute }}>L'info du jour</span><span className="block text-[14px] font-extrabold leading-[1.3]">{day ? `${day.items.length} sujet${day.items.length > 1 ? 's' : ''}` : 'Bientôt'}</span></span>
          </button>
        </div>
      </div>

      <div className="px-5 pt-3"><PushCard uid={user.id} text={isLender ? "Reçois les demandes de tes proches, leurs paiements et le décryptage du jour." : "Le décryptage du jour, le mot du jour et tes rappels d'échéance, dès qu'ils arrivent."} /></div>

      {own.length > 0 && (
        <>
          <Section title="Les articles" action="Tout voir" onAction={() => nav.onArticles()} />
          <Rail>
            {own.map((a, i) => {
              const press = a.kind === 'press';
              const c = press ? pressCover(a.zones?.length ? a.zones : zonesOf(`${a.title} ${a.sourceSection || ''} ${a.excerpt}`, a.source)) : CK_COVER;
              const tag = press ? `${a.source || 'Presse'} · ${(c as any).label}` : 'CKLabs';
              return (
                <button key={a.id} onClick={() => nav.onArticles(a.id)} className="shrink-0 w-[252px] self-start text-left">
                  {/* Carte compacte (27/11) : la source et le titre en haut, sans vide au milieu */}
                  <span className="relative overflow-hidden flex flex-col gap-2 h-[132px] rounded-2xl px-3.5 pt-3 pb-3" style={{ background: c.bg, color: c.fg }}>
                    {c.deco}
                    <span className="relative pr-10 text-[10.5px] font-extrabold tracking-[.08em] uppercase truncate" style={{ color: c.tag }}>{tag}</span>
                    <span className="relative text-[15px] font-extrabold leading-[1.3] line-clamp-4">{frTypo(a.title)}</span>
                  </span>
                  <span className="text-[12.5px] leading-[1.35] mt-1.5 line-clamp-2" style={{ color: C.mute }}>{a.excerpt ? frTypo(a.excerpt) : press ? 'Revue de presse' : `${a.readMinutes} min de lecture`}</span>
                </button>
              );
            })}
          </Rail>
        </>
      )}

      {recos.length > 0 && (
        <>
          <Section title="Mes séries et films" action="Tout voir" onAction={nav.onFilms} />
          <Rail>
            {recos.map(f => {
              const img = f.poster || (f.trailer ? trailerImage(f.trailer, 'hq') : '');
              return (
                <button key={f.id} onClick={nav.onFilms} className="shrink-0 w-[220px] text-left">
                  {/* Image entière de la bande-annonce (27/11) : le titre écrit dessus reste lisible */}
                  <span className="relative overflow-hidden block aspect-video rounded-xl" style={{ background: C.nightCard }}>
                    {img && <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />}
                    <span aria-hidden="true" className="absolute right-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(14,21,51,.72)', color: '#fff' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></svg>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 mt-2">
                    <span className="text-[15px] font-extrabold leading-[1.25] truncate">{f.title}</span>
                    <span className="shrink-0 flex items-center gap-[3px] px-[7px] py-[2px] rounded-full text-[11.5px] font-extrabold" style={{ background: C.mango, color: C.ink }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor" /></svg>
                      {String(f.rating).replace('.', ',')}
                    </span>
                  </span>
                  <span className="block text-[12.5px]" style={{ color: C.mute }}>{FILM_KIND[f.kind]}</span>
                </button>
              );
            })}
          </Rail>
        </>
      )}

      <VendrediShow />

      <Section title="Jouer entre amis" action="Tout" onAction={() => nav.onTab('amis')} />
      <div className="grid grid-cols-4 gap-2 px-5">
        {([
          ['M', 'Mot du jour', C.ochreSoft, C.ochreText, nav.onMot],
          ['J', 'Jambo', '#16204A', C.mango, nav.onJambo],
          ['B', 'Petit bac', C.greenSoft, C.green, nav.onBac],
          ['W', 'Wiseman', C.redSoft, C.red, nav.onWiseman],
        ] as const).map(([l, label, bg, fg, fn]) => (
          <button key={label} onClick={fn} className="flex flex-col items-center gap-2">
            <span className="w-[62px] h-[62px] rounded-full flex items-center justify-center display text-[18px]" style={{ background: bg, color: fg }}>{l}</span>
            <span className="text-[14px] font-extrabold leading-[1.3] text-center">{label}</span>
          </button>
        ))}
      </div>

      <InviteCard />
      <InstallCard slot="end" />
    </Screen>
  );
};

// ───────────────────────── Actu ─────────────────────────

type Zone = RZone | 'cklabs';
const ZONES: [Zone | 'tout', string][] = [['tout', 'Tout'], ['cameroun', 'Cameroun'], ['afrique', 'Afrique'], ['monde', 'Monde'], ['eco', 'Éco'], ['cklabs', 'CKLabs']];
const CM_RE = /camer|yaound|douala|biya|rdpc|elecam|bamenda|garoua|bafoussam/i;
const AF_RE = /afri|sénégal|senegal|nigeria|côte d.ivoire|rdc|congo|gabon|tchad|maroc|algérie|tunisie|kenya|mali\b|burkina|niger\b|ghana|éthiopie|soudan|libye|can 20/i;
const ECO_RE = /écono|economi|financ|bours|banque|budget|dette|inflation|entreprise|investiss|immobili|fiscal|impôt|pétrole|croissance|marché/i;
const CM_SRC = /cameroon|cameroun|ecomatin|quotidien de l.économie|actu cameroun|mimi mefo|crtv|data cameroon|business in cameroon/i;
const AF_SRC = /jeune afrique|africa intelligence|rfi afrique|monde afrique|africa report|africanews|ecofin|bbc afrique/i;
const ECO_SRC = /les echos|financial times|ecofin|ecomatin|économie|business in|investir/i;
const zonesOf = (text: string, source = ''): Zone[] => {
  const z = new Set<Zone>();
  if (CM_RE.test(text) || CM_SRC.test(source)) { z.add('cameroun'); z.add('afrique'); }
  if (AF_RE.test(text) || AF_SRC.test(source)) z.add('afrique');
  if (ECO_RE.test(text) || ECO_SRC.test(source)) z.add('eco');
  if (!z.has('afrique')) z.add('monde');
  return [...z];
};

interface FeedItem { key: string; at: string; kind: 'Décryptage' | 'Info du jour' | 'Revue de presse' | 'CKLabs'; source: string; title: string; zones: Zone[]; top: boolean; open: () => void; dec?: DecryptageDay }
const KIND_STYLE: Record<FeedItem['kind'], React.CSSProperties> = {
  'Décryptage': { background: C.night, color: C.mango },
  'Info du jour': { background: C.greenSoft, color: C.green },
  'Revue de presse': { background: C.soft, color: C.text2 },
  'CKLabs': { background: C.ochreSoft, color: C.ochreText },
};

export const ActuTab: React.FC<{ user: User; nav: Nav }> = ({ user, nav }) => {
  const decs = useLoad(listDecryptage, [] as DecryptageDay[]);
  const info = useLoad(listInfo, [] as InfoDay[]);
  const articles = useLoad(() => listArticles(user.id, false), [] as Article[]);
  const [zone, setZone] = useState<Zone | 'tout'>(() => { try { return (sessionStorage.getItem('ck_actu_zone') as Zone) || 'tout'; } catch { return 'tout'; } });
  const [essentiel, setEssentiel] = useState(() => { try { return localStorage.getItem('ck_actu_essentiel') === '1'; } catch { return false; } });
  useEffect(() => { try { sessionStorage.setItem('ck_actu_zone', zone); } catch { /* rien */ } }, [zone]);
  useEffect(() => { try { localStorage.setItem('ck_actu_essentiel', essentiel ? '1' : '0'); } catch { /* rien */ } }, [essentiel]);
  const ps = usePlayer();

  const feed = useMemo(() => {
    const out: FeedItem[] = [];
    const recent = new Date(Date.now() - 36 * 3600_000).toISOString();
    for (const d of decs) out.push({ key: `d-${d.date}`, at: `${d.date}T08:15`, kind: 'Décryptage', source: `${d.minutes} min`, title: d.title, zones: ['cameroun', 'afrique', 'monde'], top: true, open: () => nav.onInfo('decryptage'), dec: d });
    for (const day of info) for (const it of day.items) {
      out.push({ key: `i-${day.date}-${it.scope}`, at: `${day.date}T07:45`, kind: 'Info du jour', source: `${it.sources.length} sources`, title: it.title, zones: it.zones?.length ? it.zones : it.scope === 'monde' ? zonesOf(it.title + ' ' + it.summary).filter(z => z !== 'afrique' && z !== 'cameroun').concat('monde') : zonesOf(`${it.title} ${it.summary} afrique`), top: true, open: () => nav.onInfo(it.scope) });
    }
    for (const a of articles) {
      if (a.status !== 'published') continue;
      const at = a.publishedAt || a.updatedAt;
      if (a.kind === 'press') out.push({ key: a.id, at, kind: 'Revue de presse', source: a.source || '', title: a.title, zones: a.zones?.length ? a.zones : zonesOf(`${a.title} ${a.sourceSection || ''} ${a.excerpt}`, a.source), top: at >= recent, open: () => nav.onArticles(a.id) });
      else out.push({ key: a.id, at, kind: 'CKLabs', source: 'Christian', title: a.title, zones: ['cklabs', ...zonesOf(`${a.title} ${a.excerpt}`).filter(z => z === 'eco')], top: true, open: () => nav.onArticles(a.id) });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [decs, info, articles]);
  const shown = feed.filter(i => (zone === 'tout' || i.zones.includes(zone)) && (!essentiel || i.top)).slice(0, 60);

  return (
    <Screen bottomPad>
      <div className="px-5 pt-[max(env(safe-area-inset-top),22px)] pb-3.5 flex items-end justify-between">
        <h1 className="display text-[26px]">Actu</h1>
        <button onClick={() => setEssentiel(!essentiel)} role="switch" aria-checked={essentiel} className="flex items-center gap-2.5 py-2 text-[14px] font-bold">
          L'essentiel
          <span className="relative inline-block w-11 h-[26px] rounded-full transition-colors" style={{ background: essentiel ? C.green : C.border }}>
            <span className="absolute top-[3px] w-5 h-5 rounded-full bg-white transition-all" style={{ left: essentiel ? 21 : 3 }} />
          </span>
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-5" role="tablist" aria-label="Rubriques" style={{ scrollbarWidth: 'none' }}>
        {ZONES.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={zone === id} onClick={() => setZone(id)} className="shrink-0 h-[38px] px-4 rounded-full text-[14px]"
            style={zone === id ? { background: C.ink, color: '#fff', fontWeight: 800 } : { background: C.card, color: C.ink, border: `1px solid ${C.border}`, fontWeight: 700 }}>{label}</button>
        ))}
      </div>
      <div className="px-5 pt-4 flex flex-col gap-2.5">
        {shown.map(it => {
          const mine = !!it.dec && ps.track?.id === decryptageTrackId(it.dec.date);
          return (
            <div key={it.key} className="rounded-[18px] px-4 pt-3.5 pb-4" style={{ background: C.card }}>
              <button onClick={it.open} className="w-full text-left">
                <span className="flex items-center gap-2 text-[12px] font-bold" style={{ color: C.mute }}>
                  <span className="first-letter:uppercase">{dayLabel(it.at)}</span><span aria-hidden="true">·</span>
                  <span className="px-2 py-[2px] rounded-full" style={KIND_STYLE[it.kind]}>{it.kind}</span>
                  <span className="ml-auto truncate max-w-[40%]" style={{ color: C.ochreText }}>{it.source}</span>
                </span>
                <span className="block mt-2 text-[16.5px] leading-[1.35] font-extrabold">{frTypo(it.title)}</span>
              </button>
              {it.dec && (
                <button onClick={() => playDecryptage(it.dec!, () => nav.onInfo('decryptage'))} className="mt-2.5 flex items-center gap-2 text-[13px] font-bold">
                  <span className="w-[30px] h-[30px] rounded-full flex items-center justify-center" style={{ background: C.mango, color: C.ink }}>
                    {mine && ps.playing ? <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" /><rect x="11.5" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" /></svg>
                      : <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3.2v13.6L16.5 10z" fill="currentColor" /></svg>}
                  </span>
                  {mine && ps.playing ? 'Pause' : `Écouter · ${it.dec.minutes} min`}
                </button>
              )}
            </div>
          );
        })}
        {!shown.length && <div className="text-center text-[14px] py-10" style={{ color: C.mute }}>{feed.length ? 'Rien dans cette rubrique pour l’instant.' : 'Chargement…'}</div>}
      </div>
    </Screen>
  );
};

// ───────────────────────── Entre amis ─────────────────────────

const ListRow: React.FC<{ icon: IconName; title: string; sub?: string; onClick: () => void; first?: boolean }> = ({ icon, title, sub, onClick, first }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left" style={{ borderTop: first ? undefined : `1px solid ${C.line}` }}>
    <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: C.night, color: C.mango }}><Icon name={icon} size={19} /></span>
    <span className="flex-1 min-w-0"><span className="block text-[15px] font-bold">{title}</span>{sub && <span className="block text-[13px]" style={{ color: C.mute }}>{sub}</span>}</span>
    <span style={{ color: C.mute }}><Icon name="chevron" size={18} /></span>
  </button>
);

export const AmisTab: React.FC<{ nav: Nav }> = ({ nav }) => {
  const events = useLoad(() => listEvents(), [] as AppEvent[]);
  const next = sortUpcoming(events).slice(0, 3);
  const games: [string, string, string, string, string, () => void][] = [
    ['J', 'Jambo', 'Fap Fap, seul ou à plusieurs', '#16204A', C.mango, nav.onJambo],
    ['B', 'Petit bac', 'Sans feuille ni stylo', C.card, C.green, nav.onBac],
    ['W', 'Le Wiseman', "Trouve l'intrus", C.card, C.red, nav.onWiseman],
  ];
  return (
    <Screen bottomPad>
      <div className="px-5 pt-[max(env(safe-area-inset-top),22px)] pb-3.5">
        <h1 className="display text-[26px]">Entre amis</h1>
        <div className="text-[14px] mt-1" style={{ color: C.mute }}>Jouer et sortir ensemble</div>
      </div>
      <VendrediShow standalone />

      <Section title="Jouer" />
      <div className="px-5 grid grid-cols-2 gap-2.5">
        <MotTile onClick={nav.onMot} />
        {games.map(([l, title, sub, bg, fg, fn]) => (
          <button key={title} onClick={fn} className="rounded-[18px] p-3.5 flex flex-col gap-2.5 text-left" style={{ background: bg, color: bg === C.card ? C.ink : '#fff' }}>
            <span className="w-10 h-10 rounded-xl flex items-center justify-center display text-[16px]" style={{ background: bg === C.card ? C.soft : 'rgba(255,255,255,.12)', color: fg }}>{l}</span>
            <span><span className="block text-[15px] font-extrabold">{title}</span><span className="block text-[12.5px]" style={{ color: bg === C.card ? C.mute : C.nightMute }}>{sub}</span></span>
          </button>
        ))}
      </div>

      <Section title="Événements à venir" action="Tout voir" onAction={() => nav.onEvents()} />
      <div className="px-5">
        {next.length ? (
          <Card>
            {next.map((e, i) => (
              <button key={e.id} onClick={() => nav.onEvents(e.id)} className="w-full flex items-center gap-3.5 px-3.5 py-3 text-left" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <span className="w-12 h-[52px] rounded-xl flex flex-col items-center justify-center shrink-0 leading-none" style={{ background: C.night, color: C.nightText }}>
                  <span className="text-[18px] font-extrabold">{dayBlock(e.startsAt).day}</span>
                  <span className="text-[10.5px] font-extrabold uppercase mt-1" style={{ color: C.mango }}>{dayBlock(e.startsAt).month}</span>
                </span>
                <span className="flex-1 min-w-0"><span className="block text-[15px] font-extrabold truncate">{e.title}</span><span className="block text-[13px] truncate" style={{ color: C.mute }}>{isLive(e) ? 'En cours' : e.venue || ''}</span></span>
                <span style={{ color: C.mute }}><Icon name="chevron" size={18} /></span>
              </button>
            ))}
          </Card>
        ) : <button onClick={() => nav.onEvents()} className="text-[14px] font-bold" style={{ color: C.ochreText }}>Voir l'agenda</button>}
      </div>

      <div className="px-5 pt-3">
        <Card>
          <ListRow first icon="pin" title="Mes adresses" sub="Les lieux que je recommande" onClick={nav.onAdresses} />
          <ListRow icon="glass" title="Films et séries" sub="Mes notes et mes avis" onClick={nav.onFilms} />
          <ListRow icon="news" title="Les articles" sub="CKLabs et la revue de presse" onClick={() => nav.onArticles()} />
        </Card>
      </div>
      <InviteCard />
    </Screen>
  );
};

// ───────────────────────── Activité (la cloche) ─────────────────────────

export const ActivityScreen: React.FC<{ user: User; loans: Loan[]; isLender: boolean; onBack: () => void; onOpenLoan: (l: Loan) => void }> = ({ user, loans, isLender, onBack, onOpenLoan }) => {
  const [notifs, setNotifs] = useState<Notification[] | null>(null);
  useEffect(() => { getUserNotifications(user.id).then(setNotifs).catch(() => setNotifs([])); }, [user.id]);
  return (
    <Screen>
      <TopBar onBack={onBack} title="Notifications" />
      <div className="px-5 pt-2">
        {notifs === null ? <div className="text-sm" style={{ color: C.mute }}>Chargement…</div> : notifs.length ? (
          <Card>
            {notifs.slice(0, 40).map((n, i) => (
              <button key={n.id} onClick={() => { markNotificationAsRead(n.id); setNotifs(l => (l || []).map(x => x.id === n.id ? { ...x, read: true } : x)); const l = loans.find(x => x.id === n.loanId); if (l) onOpenLoan(l); }}
                className="w-full text-left flex gap-3 px-4 py-3.5" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
                <span className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: n.read ? 'transparent' : C.ochre }} />
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold">{n.title}</span>
                  <span className="block text-[13px]" style={{ color: C.mute }}>{n.message}</span>
                </span>
                <span className="text-xs shrink-0" style={{ color: C.mute }}>{dateFr(n.date, { day: 'numeric', month: 'short' })}</span>
              </button>
            ))}
          </Card>
        ) : <div className="text-sm" style={{ color: C.mute }}>Rien de nouveau pour l'instant.</div>}
      </div>
      {isLender && (
        <>
          <div className="px-5 pt-8 pb-3 text-[17px] font-bold">Impôts et obligations</div>
          <div className="px-5 pb-10"><FiscalPanel loans={loans} lenderUid={user.id} /></div>
        </>
      )}
    </Screen>
  );
};

// ───────────────────────── Profil d'un proche (qui ne prête pas) ─────────────────────────

export const FriendProfile: React.FC<{
  user: User; profile: Profile | null; loans: Loan[];
  onEditIdentity: () => void; onOpenContract: (l: Loan) => void; onBecomeLender: () => void;
  onLegal: (v: 'cgu' | 'privacy') => void; onLogout: () => void; nav: Nav;
}> = (p) => {
  const contract = p.loans.filter(l => l.borrowerUid === p.user.id && l.contractText)[0];
  return (
    <Screen bottomPad>
      <div className="px-5 pt-[max(env(safe-area-inset-top),22px)]"><h1 className="display text-[26px]">Profil</h1></div>
      <div className="px-5 pt-5 flex items-center gap-3.5">
        <Avatar name={p.profile?.fullName || p.user.name} size={56} />
        <div className="min-w-0">
          <div className="text-[17px] font-bold truncate">{p.profile?.fullName || p.user.name}</div>
          <div className="text-sm truncate" style={{ color: C.mute }}>{p.user.email}</div>
        </div>
      </div>
      <div className="px-5 pt-6 flex flex-col gap-3">
        <Card>
          <ListRow first icon="user" title="Mes informations" onClick={p.onEditIdentity} />
          {contract && <ListRow icon="file" title="Mon dernier contrat" onClick={() => p.onOpenContract(contract)} />}
          <ListRow icon="bell" title="Mes notifications" onClick={p.nav.onActivity} />
        </Card>
        <Card>
          <ListRow first icon="pin" title="Mes adresses" onClick={p.nav.onAdresses} />
          <ListRow icon="glass" title="Films et séries" onClick={p.nav.onFilms} />
        </Card>
        <div className="rounded-2xl p-4" style={{ background: C.ochreSoft }}>
          <div className="text-[15px] font-bold">Toi aussi, prête à tes proches</div>
          <div className="text-[13.5px] leading-snug mt-1" style={{ color: C.text2 }}>Contrat signé avec le doigt, rappels automatiques, suivi des remboursements.</div>
          <Button className="mt-3" onClick={p.onBecomeLender}>Prêter à mes proches</Button>
        </div>
        <Card>
          <ListRow first icon="file" title="Conditions d'utilisation" onClick={() => p.onLegal('cgu')} />
          <ListRow icon="lock" title="Confidentialité" onClick={() => p.onLegal('privacy')} />
        </Card>
        <InstallButton className="w-full" />
        <Button variant="danger" onClick={p.onLogout}><Icon name="logout" size={20} /> Se déconnecter</Button>
        <Note>CKMoney est un outil personnel de suivi de prêts entre proches. Il ne détient aucun fonds.</Note>
      </div>
    </Screen>
  );
};
