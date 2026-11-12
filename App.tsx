import React, { useCallback, useEffect, useState, ErrorInfo, ReactNode, Suspense, lazy } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from './services/firebase';
import { Loan, Profile, User, Invite, isProfileComplete } from './types';
import { getProfile } from './services/profileService';
import {
  getUserLoans, getLoanById, watchUserLoans, getInvite, claimInvite, getLenderCard, publishLenderCard, requestLinkFor, resolveHandle, LenderCard, KnownFriend,
} from './services/loanService';
import { checkAutomaticNotifications } from './services/notificationService';
import { refreshPushToken } from './services/push';
import { canCreateLoans } from './config/legal';
import { Screen, TabBar, Button, Note, Toast, C, euro2, dateFr } from './components/v2/ui';
import LenderTabs from './components/v2/LenderTabs';
import NewLoanFlow from './components/v2/NewLoanFlow';
import LoanDetail from './components/v2/LoanDetail';
import RequestReview from './components/v2/RequestReview';
import Auth from './components/v2/Auth';
import { Landing, BorrowerSignFlow, RequestFlow, BorrowerSpace, IdentityEditor } from './components/v2/FriendFlows';
import ProfileSetup from './components/ProfileSetup';
import LegalDocs from './components/LegalDocs';
import ContractPreview from './components/ContractPreview';
import CKLogo from './components/brand/CKLogo';
// Articles et Jambo : chargés seulement quand on les ouvre
const ArticlesScreen = lazy(() => import('./components/v2/Articles'));
const Jambo = lazy(() => import('./components/v2/Jambo'));
const Bac = lazy(() => import('./components/v2/Bac'));
const Wiseman = lazy(() => import('./components/v2/Wiseman'));

const toUser = (u: FirebaseUser): User => ({
  id: u.uid,
  name: u.displayName || u.email?.split('@')[0] || 'Utilisateur',
  email: (u.email || '').toLowerCase(),
  avatar: u.photoURL || undefined,
});

// Liens WhatsApp : /p/<prénom-montant-code> (contrat à signer) et /<prénom> (lien de demande).
// Les anciennes formes /?i=… et /?d=… restent acceptées. On les garde en session pour
// qu'ils survivent à la connexion.
const readLinks = (): { i: string | null; d: string | null } => {
  try {
    const sp = new URLSearchParams(window.location.search);
    const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, '');
    let i = sp.get('i'), d = sp.get('d');
    const m = path.match(/^p\/([A-Za-z0-9.\-]+)$/);
    if (m) i = m[1];
    else if (path && /^[A-Za-z0-9-]{2,40}$/.test(path)) d = path.toLowerCase();
    if (i) sessionStorage.setItem('ck_i', i);
    if (d) sessionStorage.setItem('ck_d', d);
    return { i: i || sessionStorage.getItem('ck_i'), d: d || sessionStorage.getItem('ck_d') };
  } catch { return { i: null, d: null }; }
};
const initialLinks = readLinks();
const clearParam = (key: 'i' | 'd') => {
  try { sessionStorage.removeItem(`ck_${key}`); window.history.replaceState({}, '', '/'); } catch { /* ignore */ }
};

class ErrorBoundary extends React.Component<{ children?: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Erreur inattendue', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Screen>
        <div className="flex-1 flex flex-col justify-center px-6 gap-4">
          <h1 className="text-[24px] font-bold">Un souci est survenu</h1>
          <p className="text-[15px]" style={{ color: C.mute }}>L'appli a rencontré une erreur inattendue. Tes données ne sont pas perdues.</p>
          <Button onClick={() => window.location.reload()}>Recharger</Button>
        </div>
      </Screen>
    );
  }
}

type Overlay =
  | { k: 'loan'; id: string }
  | { k: 'sign'; id: string }
  | { k: 'new'; prefill?: { friend?: KnownFriend; amount?: number; dueDate?: string; counterOf?: string }; edit?: Loan }
  | { k: 'request'; uid: string; name: string }
  | { k: 'profile' }
  | { k: 'identity' }
  | { k: 'borrower' }
  | { k: 'legal'; v: 'cgu' | 'privacy' }
  | { k: 'contract'; id: string }
  | { k: 'articles'; back?: Overlay }
  | { k: 'jambo'; back?: Overlay }
  | { k: 'bac'; back?: Overlay }
  | { k: 'wiseman'; back?: Overlay };

const Splash = () => (
  <Screen><div className="flex-1 flex items-center justify-center"><div className="animate-pulse"><CKLogo size="lg" /></div></div></Screen>
);

const App: React.FC = () => {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, u => { setFbUser(u); setAuthReady(true); }), []);
  // Un invité du Jambo (connexion anonyme) n'est pas un compte CKMoney : il voit l'écran de connexion.
  const user: User | null = fbUser && !fbUser.isAnonymous ? toUser(fbUser) : null;
  const isLender = !!user && canCreateLoans(user.email);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'home' | 'loans' | 'activity' | 'profile'>('home');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Liens entrants
  const [inviteToken, setInviteToken] = useState<string | null>(initialLinks.i);
  // Lien de demande : adresse courte (/christian) ou identifiant, résolu en uid du prêteur
  const [requestRaw] = useState<string | null>(initialLinks.d);
  const [requestLender, setRequestLender] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [lenderCard, setLenderCard] = useState<LenderCard | null | undefined>(undefined);
  const [landingDone, setLandingDone] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => { if (inviteToken) getInvite(inviteToken).then(setInvite).catch(() => setInvite(null)); }, [inviteToken]);
  useEffect(() => {
    if (!requestRaw) return;
    (async () => {
      const uid = (await resolveHandle(requestRaw)) || requestRaw;
      const card = await getLenderCard(uid);
      setRequestLender(uid);
      setLenderCard(card);
    })();
  }, [requestRaw]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const p = await getProfile(user.id).catch(() => null);
    setProfile(p);
    setProfileLoaded(true);
  }, [user?.id]);

  const refreshLoans = useCallback(async () => {
    if (!user) return;
    try {
      const l = await getUserLoans(user.id);
      setLoans(l);
      checkAutomaticNotifications(l, user.id).catch(() => undefined);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    if (!user) { setProfile(null); setProfileLoaded(false); setLoans([]); setLoading(true); return; }
    loadProfile();
    refreshLoans();
    refreshPushToken(user.id);
  }, [user?.id]);

  // Ouverture depuis une notification : /?loan=<id>
  useEffect(() => {
    if (!user) return;
    try {
      const id = new URLSearchParams(window.location.search).get('loan');
      if (id) { window.history.replaceState({}, '', '/'); setOverlay({ k: 'loan', id }); }
    } catch { /* ignore */ }
  }, [user?.id]);

  // Mise à jour en direct : une demande, une signature ou un paiement apparaît sans rouvrir l'appli
  useEffect(() => (user ? watchUserLoans(user.id, refreshLoans) : undefined), [user?.id, refreshLoans]);

  // Rafraîchir quand l'appli revient au premier plan (une demande a pu arriver)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') refreshLoans(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshLoans]);

  // Carte publique du prêteur (prénom + lien de paiement), lue via le lien de demande
  useEffect(() => {
    if (user && isLender && isProfileComplete(profile)) publishLenderCard(user.id, profile).then(setHandle).catch(e => console.warn('Carte prêteur', e));
  }, [user?.id, isLender, profile?.fullName, profile?.paymentLink]);

  // Une fois connecté : traiter le lien d'invitation
  useEffect(() => {
    if (!user || !inviteToken) return;
    claimInvite(inviteToken, user)
      .then(async loanId => { clearParam('i'); setInviteToken(null); await refreshLoans(); setOverlay({ k: 'sign', id: loanId }); })
      .catch(e => {
        clearParam('i'); setInviteToken(null);
        const m = (e as Error).message;
        setLinkError(m === 'deja_utilise' ? "Ce lien a déjà été utilisé par quelqu'un d'autre. Demande à la personne de t'en renvoyer un."
          : m === 'propre_lien' ? "C'est ton propre lien : envoie-le à ton proche pour qu'il signe."
          : "Ce lien n'est plus valable. Demande à la personne de t'en renvoyer un.");
      });
  }, [user?.id, inviteToken]);

  // …et le lien de demande
  useEffect(() => {
    if (!user || !requestLender || lenderCard === undefined) return;
    clearParam('d'); setRequestLender(null);
    if (requestLender === user.id) { setToast("C'est ton lien de demande : envoie-le à tes proches."); return; }
    if (!lenderCard) { setLinkError("Ce lien de demande n'est pas valable."); return; }
    setOverlay({ k: 'request', uid: requestLender, name: lenderCard.firstName });
  }, [user?.id, requestLender, lenderCard]);

  const logout = async () => { await signOut(auth); setOverlay(null); setTab('home'); window.scrollTo(0, 0); };
  const close = () => { setOverlay(null); window.scrollTo(0, 0); };
  const openLoan = (l: Loan) => { setOverlay(l.status === 'pending_borrower' && l.borrowerUid === user?.id ? { k: 'sign', id: l.id } : { k: 'loan', id: l.id }); window.scrollTo(0, 0); };

  // ---------- Avant connexion
  if (!authReady) return <Splash />;
  if (!user) {
    if (inviteToken && !landingDone) {
      if (invite === undefined) return <Splash />;
      if (invite) return (
        <Landing eyebrow="Contrat de prêt" title={<>{invite.lenderFirstName} te prête</>} amount={euro2(invite.amount, invite.currency)}
          rows={[
            ['Remboursement', invite.scheduleSummary === 'En une fois' ? `En une fois, le ${dateFr(invite.firstDueDate)}` : `${invite.scheduleSummary}, à partir du ${dateFr(invite.firstDueDate, { day: 'numeric', month: 'long' })}`],
            ['Intérêts', invite.interestRate ? `${invite.interestRate.toLocaleString('fr-FR')} % par an` : 'Aucun'],
          ]}
          cta="Voir et signer" onContinue={() => setLandingDone(true)} />
      );
    }
    if (requestRaw && !landingDone) {
      if (lenderCard === undefined) return <Splash />;
      if (lenderCard) return (
        <Landing eyebrow={`De la part de ${lenderCard.firstName}`} title={<>Tes demandes à {lenderCard.firstName}, au même endroit</>}
          bullets={[
            'Choisis le montant et la date à laquelle tu rembourses.',
            `Signe ta demande avec le doigt : ${lenderCard.firstName} la reçoit tout de suite.`,
            `Tu suis ce que tu dois et tu règles en un geste${lenderCard.paymentLink && /paypal/i.test(lenderCard.paymentLink) ? ' avec PayPal' : ''}.`,
          ]}
          cta="Commencer" onContinue={() => setLandingDone(true)} />
      );
    }
    return (
      <ErrorBoundary>
        <Auth
          context={invite ? `Connecte-toi pour signer le prêt de ${invite.lenderFirstName}.` : lenderCard ? `Connecte-toi pour faire ta demande à ${lenderCard.firstName}.` : undefined}
          onBack={landingDone ? () => setLandingDone(false) : undefined} />
      </ErrorBoundary>
    );
  }

  if (!profileLoaded) return <Splash />;

  // ---------- Erreur de lien
  if (linkError) return (
    <Screen>
      <div className="flex-1 flex flex-col justify-center px-6 gap-4">
        <CKLogo size="md" />
        <Note tone="warn">{linkError}</Note>
        <Button onClick={() => setLinkError(null)}>Continuer</Button>
      </div>
    </Screen>
  );

  // ---------- Premier passage du prêteur : son identité pour les contrats
  if (isLender && !isProfileComplete(profile) && !overlay) {
    const hasBorrowerSide = loans.some(l => l.borrowerUid === user.id);
    if (!hasBorrowerSide) return <ProfileSetup user={user} initial={profile} onSaved={p => setProfile(p)} />;
  }

  const findLoan = (id: string) => loans.find(l => l.id === id);

  // ---------- Écrans superposés
  if (overlay) {
    const content = (() => {
      switch (overlay.k) {
        case 'legal': return <LegalDocs view={overlay.v} onClose={close} />;
        case 'articles': return <Suspense fallback={<Splash />}><ArticlesScreen user={user} isAuthor={isLender} onBack={() => setOverlay(overlay.back || null)} /></Suspense>;
        case 'jambo': return <Suspense fallback={<Splash />}><Jambo playerName={profile?.fullName || user.name} onBack={() => setOverlay(overlay.back || null)} /></Suspense>;
        case 'bac': return <Suspense fallback={<Splash />}><Bac playerName={profile?.fullName || user.name} onBack={() => setOverlay(overlay.back || null)} /></Suspense>;
        case 'wiseman': return <Suspense fallback={<Splash />}><Wiseman playerName={profile?.fullName || user.name} onBack={() => setOverlay(overlay.back || null)} /></Suspense>;
        case 'contract': {
          const l = findLoan(overlay.id);
          return l ? <ContractPreview loan={l} onClose={() => setOverlay(isLender ? { k: 'borrower' } : null)} /> : <LoanLoader id={overlay.id} onLoaded={refreshLoans} onMissing={close} />;
        }
        case 'profile': return <ProfileSetup user={user} initial={profile} onSaved={p => { setProfile(p); close(); setToast('Informations enregistrées'); }} onCancel={close} />;
        case 'identity': return <IdentityEditor user={user} profile={profile} onClose={close} onSaved={() => { loadProfile(); setToast('Informations enregistrées'); }} />;
        case 'new':
          if (!isProfileComplete(profile)) return <ProfileSetup user={user} initial={profile} onSaved={p => setProfile(p)} onCancel={close} />;
          return <NewLoanFlow user={user} profile={profile} loans={loans} prefill={overlay.prefill} editLoan={overlay.edit} onClose={close}
            onDone={id => { refreshLoans().then(() => setOverlay({ k: 'loan', id })); }} />;
        case 'request':
          return <RequestFlow user={user} profile={profile} lenderUid={overlay.uid} lenderFirstName={overlay.name}
            onBack={close} onDone={() => { refreshLoans(); setOverlay(isLender ? { k: 'borrower' } : null); }} onProfileChanged={loadProfile} />;
        case 'sign': {
          const l = findLoan(overlay.id);
          if (!l) return <LoanLoader id={overlay.id} onLoaded={refreshLoans} onMissing={close} />;
          if (l.status !== 'pending_borrower') return <LoanDetail loan={l} user={user} profile={profile} onBack={close} onChanged={refreshLoans} onEdit={x => setOverlay({ k: 'new', edit: x })} />;
          return <BorrowerSignFlow loan={l} user={user} profile={profile} onBack={close} onProfileChanged={loadProfile}
            onDone={() => { refreshLoans(); setOverlay({ k: 'loan', id: l.id }); }} />;
        }
        case 'loan': {
          const l = findLoan(overlay.id);
          if (!l) return <LoanLoader id={overlay.id} onLoaded={refreshLoans} onMissing={close} />;
          if (l.status === 'requested' && l.lenderUid === user.id) {
            if (!isProfileComplete(profile)) return <ProfileSetup user={user} initial={profile} onSaved={p => setProfile(p)} onCancel={close} />;
            return <RequestReview loan={l} user={user} profile={profile} loans={loans} onBack={close} onChanged={refreshLoans}
              onModify={(friend, amount, dueDate) => setOverlay({ k: 'new', prefill: { friend, amount, dueDate, counterOf: l.id } })} />;
          }
          return <LoanDetail loan={l} user={user} profile={profile} onBack={close} onChanged={refreshLoans} onEdit={x => setOverlay({ k: 'new', edit: x })} />;
        }
        case 'borrower':
          return <BorrowerSpace user={user} profile={profile} loans={loans} loading={loading} onOpenLoan={openLoan}
            onRequest={(uid, name) => setOverlay({ k: 'request', uid, name })} onEditIdentity={() => setOverlay({ k: 'identity' })}
            onLogout={logout} onLegal={v => setOverlay({ k: 'legal', v })} onBack={isLender ? close : undefined}
            onOpenContract={l => setOverlay({ k: 'contract', id: l.id })}
            onArticles={() => setOverlay({ k: 'articles', back: { k: 'borrower' } })} onJambo={() => setOverlay({ k: 'jambo', back: { k: 'borrower' } })} onBac={() => setOverlay({ k: 'bac', back: { k: 'borrower' } })} onWiseman={() => setOverlay({ k: 'wiseman', back: { k: 'borrower' } })} />;
      }
    })();
    return <ErrorBoundary>{content}<Toast text={toast} onDone={() => setToast(null)} /></ErrorBoundary>;
  }

  // ---------- Ami (pas prêteur) : son espace
  if (!isLender) return (
    <ErrorBoundary>
      <BorrowerSpace user={user} profile={profile} loans={loans} loading={loading} onOpenLoan={openLoan}
        onRequest={(uid, name) => setOverlay({ k: 'request', uid, name })} onEditIdentity={() => setOverlay({ k: 'identity' })}
        onLogout={logout} onLegal={v => setOverlay({ k: 'legal', v })} onOpenContract={l => setOverlay({ k: 'contract', id: l.id })}
        onArticles={() => setOverlay({ k: 'articles' })} onJambo={() => setOverlay({ k: 'jambo' })} onBac={() => setOverlay({ k: 'bac' })} onWiseman={() => setOverlay({ k: 'wiseman' })} />
      <Toast text={toast} onDone={() => setToast(null)} />
    </ErrorBoundary>
  );

  // ---------- Prêteur
  const toHandle = loans.filter(l => l.lenderUid === user.id && (l.status === 'requested' || l.status === 'delay_requested' || (l.payments || []).some(p => p.status === 'declared'))).length;
  const hasBorrowerSide = loans.some(l => l.borrowerUid === user.id);
  return (
    <ErrorBoundary>
      <LenderTabs tab={tab} user={user} profile={profile} loans={loans} loading={loading} onOpenLoan={openLoan}
        onCreate={() => setOverlay({ k: 'new' })} onEditProfile={() => setOverlay({ k: 'profile' })} onLogout={logout}
        onLegal={v => setOverlay({ k: 'legal', v })} requestLink={requestLinkFor(handle || user.id)}
        onBorrowerSpace={hasBorrowerSide ? () => setOverlay({ k: 'borrower' }) : undefined}
        onArticles={() => setOverlay({ k: 'articles' })} onJambo={() => setOverlay({ k: 'jambo' })} onBac={() => setOverlay({ k: 'bac' })} onWiseman={() => setOverlay({ k: 'wiseman' })} />
      <TabBar tab={tab} onTab={t => { setTab(t); window.scrollTo(0, 0); }} onCreate={() => setOverlay({ k: 'new' })} badge={toHandle} />
      <Toast text={toast} onDone={() => setToast(null)} />
    </ErrorBoundary>
  );
};

/** Prêt pas encore dans la liste (ouvert depuis un lien) : on recharge. */
const LoanLoader: React.FC<{ id: string; onLoaded: () => Promise<void>; onMissing: () => void }> = ({ id, onLoaded, onMissing }) => {
  useEffect(() => {
    getLoanById(id).then(l => (l ? onLoaded() : onMissing())).catch(onMissing);
  }, [id]);
  return <Splash />;
};

export default App;
