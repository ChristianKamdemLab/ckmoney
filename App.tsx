import React, { useState, useEffect, useCallback, ErrorInfo, ReactNode } from 'react';
import { Loan, User, Profile, isProfileComplete } from './types';
import LoanCard from './components/LoanCard';
import LoanForm from './components/LoanForm';
import ContractPreview from './components/ContractPreview';
import BorrowerDashboard from './components/BorrowerDashboard';
import AuthScreen from './components/AuthScreen';
import VerifyEmailScreen from './components/VerifyEmailScreen';
import BorrowerSign from './components/BorrowerSign';
import FiscalPanel from './components/FiscalPanel';
import NotificationCenter from './components/NotificationCenter';
import LegalDocs from './components/LegalDocs';
import CKLogo from './components/brand/CKLogo';
import InstallPrompt from './components/InstallPrompt';
import ProfileSetup from './components/ProfileSetup';
import BorrowerHome from './components/BorrowerHome';
import { getProfile } from './services/profileService';
import { PlusCircle, LayoutDashboard, ShieldCheck, User as UserIcon, LogOut, Loader2 } from 'lucide-react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from './services/firebase';
import { fetchExchangeRate } from './services/exchangeRate';
import { getUserLoans, getLoanById } from './services/loanService';
import { checkAutomaticNotifications } from './services/notificationService';
import { computeSituation } from './utils/schedule';
import { LEGAL_INTEREST_RATE, canCreateLoans, LENDER_ALLOWLIST } from './config/legal';

const toUser = (u: FirebaseUser): User => ({
  id: u.uid,
  name: u.displayName || u.email?.split('@')[0] || 'Utilisateur',
  email: (u.email || '').toLowerCase(),
  avatar: u.photoURL || undefined,
});

// Lien d'invitation : https://…/?pret=<id>
const readInviteId = () => {
  try { return new URLSearchParams(window.location.search).get('pret'); } catch { return null; }
};
const clearInviteParam = () => {
  try { window.history.replaceState({}, '', window.location.pathname); } catch { /* ignore */ }
};

// --- 0. ERROR BOUNDARY ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
          <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-md w-full">
            <h1 className="text-xl font-black text-slate-900 mb-2">Une erreur est survenue</h1>
            <p className="text-sm text-slate-500 mb-6">L'application a rencontré un problème inattendu.</p>
            <button 
              onClick={() => {
                  localStorage.clear();
                  window.location.reload();
              }} 
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs"
            >
              Réinitialiser et Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  // --- 1. INITIALISATION ---
  // L'état de connexion vient de Firebase (et non plus du stockage local).
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [, setAuthTick] = useState(0); // force un rendu après vérification de l'email
  const [inviteId, setInviteId] = useState<string | null>(readInviteId);
  const [inviteError, setInviteError] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, u => { setFbUser(u); setAuthReady(true); }), []);
  const user: User | null = fbUser && fbUser.emailVerified ? toUser(fbUser) : null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [viewChoice, setViewChoice] = useState<'lender' | 'borrower' | null>(null);
  const [createAfterProfile, setCreateAfterProfile] = useState(false);
  useEffect(() => {
    if (!user) { setProfile(null); setProfileLoaded(false); return; }
    getProfile(user.id).then(p => setProfile(p)).catch(() => setProfile(null)).finally(() => setProfileLoaded(true));
  }, [user?.id]);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paid' | 'pending'>('all');
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false); 
  const [legalView, setLegalView] = useState<'cgu' | 'privacy' | null>(null); // State pour les pages légales
  
  // Dashboard Stats State
  const [stats, setStats] = useState({ outstanding: 0, recovered: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  useEffect(() => {
    // On ne supprime PAS 'ckmoney_loans_backup' : il peut contenir d'anciens prêts jamais synchronisés.
    try { localStorage.removeItem('ckmoney_user'); } catch { /* ignore */ }
    if (!user) setLoans([]);
  }, [user?.email]);

  // --- 2. LOGIQUE DASHBOARD ---
  const userEmail = user?.email;
  const refreshLoans = useCallback(async () => {
    if (userEmail) {
        setLoadingLoans(true);
        try {
            const fetchedLoans = await getUserLoans(userEmail);
            setLoans(fetchedLoans);
            // Rafraîchit le prêt ouvert, s'il y en a un
            setSelectedLoan(prev => prev ? (fetchedLoans.find(l => l.id === prev.id) || prev) : prev);
            checkAutomaticNotifications(fetchedLoans, userEmail);
        } catch (e) {
            console.error("Erreur refresh loans", e);
        } finally {
            setLoadingLoans(false);
        }
    }
  }, [userEmail]);

  // Ouverture d'un prêt depuis un lien d'invitation
  useEffect(() => {
    if (!user || !inviteId) return;
    getLoanById(inviteId)
      .then(loan => {
        if (loan) { setSelectedLoan(loan); setInviteId(null); clearInviteParam(); }
        else setInviteError("Ce contrat est introuvable.");
      })
      .catch(() => setInviteError(`Ce contrat est réservé à l'adresse email indiquée par le prêteur. Vous êtes connecté avec ${user.email}.`));
  }, [user?.email, inviteId]);

  // Trigger refresh quand l'utilisateur change ou est défini initialement
  useEffect(() => {
    if (user) {
        refreshLoans();
    }
  }, [refreshLoans, userEmail]);

  // Recalcul stats
  useEffect(() => {
    if (loans.length > 0) {
        const updateStats = async () => {
          setIsStatsLoading(true);
          try {
              const sumsByCurrency: Record<string, { active: number, paid: number }> = {};
              
              loans.filter(l => l.lenderEmail === userEmail).forEach(loan => {
                if (!sumsByCurrency[loan.currency]) {
                  sumsByCurrency[loan.currency] = { active: 0, paid: 0 };
                }
                if (loan.status === 'pending_borrower') return;
                const s = computeSituation(loan, LEGAL_INTEREST_RATE);
                sumsByCurrency[loan.currency].active += s.totalDueNow;
                sumsByCurrency[loan.currency].paid += s.confirmedPaid;
              });

              let totalOutstanding = 0;
              let totalRecovered = 0;

              await Promise.all(Object.keys(sumsByCurrency).map(async (currency) => {
                const { active, paid } = sumsByCurrency[currency];
                if (active > 0) totalOutstanding += await fetchExchangeRate(active, currency);
                if (paid > 0) totalRecovered += await fetchExchangeRate(paid, currency);
              }));

              setStats({ outstanding: totalOutstanding, recovered: totalRecovered });
          } catch(e) {
              console.error("Erreur stats", e);
          } finally {
              setIsStatsLoading(false);
          }
        };
        updateStats();
    }
  }, [loans]);

  // --- ACTIONS ---
  const handleLogin = (_newUser: User) => { /* l'état est mis à jour par onAuthStateChanged */ };
  
  const handleLogout = () => { signOut(auth); setSelectedLoan(null); };
  const lenderLoans = loans.filter(l => l.lenderEmail === user?.email);
  const borrowerLoans = loans.filter(l => (l.borrowerEmail || '').toLowerCase() === user?.email);
  const openCreate = () => {
    if (!isProfileComplete(profile)) { setEditingProfile(true); setCreateAfterProfile(true); return; }
    setIsFormOpen(true);
  };
  const mayLend = canCreateLoans(user?.email);
  
  const handleViewContract = (loan: Loan) => {
      setIsFormOpen(false);
      setSelectedLoan(loan);
      setAutoPrint(true);
  };

  // Vue par défaut : espace emprunteur pour qui n'a fait qu'emprunter
  const currentView = viewChoice ?? (borrowerLoans.length > 0 && lenderLoans.length === 0 ? 'borrower' : 'lender');
  const filteredLoans = lenderLoans.filter(loan => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return loan.status === 'pending_borrower';
    return loan.status === activeTab;
  });

  // --- RENDU ---
  
  // 1. Login
  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;
  }
  if (fbUser && !fbUser.emailVerified) {
    return <VerifyEmailScreen firebaseUser={fbUser} onVerified={() => setAuthTick(t => t + 1)} />;
  }
  if (!user) {
    return <AuthScreen onLogin={handleLogin} inviteMode={!!inviteId} />;
  }

  // 1 bis. Profil du prêteur, à compléter une seule fois
  // Affiché à la première connexion d'un prêteur déclaré (VITE_LENDER_EMAILS),
  // ou au premier clic sur « Créer », ou depuis « Mon profil ».
  const declaredLender = LENDER_ALLOWLIST.includes(user.email);
  if (mayLend && !inviteId && profileLoaded && (editingProfile || (declaredLender && !isProfileComplete(profile)))) {
    return <ProfileSetup user={user} initial={profile}
             onSaved={p => { setProfile(p); setEditingProfile(false); if (createAfterProfile) { setCreateAfterProfile(false); setIsFormOpen(true); } }}
             onCancel={isProfileComplete(profile) || createAfterProfile ? () => { setEditingProfile(false); setCreateAfterProfile(false); } : undefined} />;
  }

  // 2. Pages Légales
  if (legalView) {
    return <LegalDocs view={legalView} onClose={() => setLegalView(null)} />;
  }

  // 3. Modales
  if (selectedLoan) {
      const isBorrower = (selectedLoan.borrowerEmail || '').toLowerCase() === user.email;
      if (isBorrower && selectedLoan.status === 'pending_borrower') {
          return <BorrowerSign loan={selectedLoan} user={user} onClose={() => setSelectedLoan(null)}
                   onSigned={async () => { const l = await getLoanById(selectedLoan.id); setSelectedLoan(null); await refreshLoans(); if (l) { setAutoPrint(false); setSelectedLoan(l); } }} />;
      }
      if (isBorrower) {
          return <BorrowerDashboard loan={selectedLoan} onClose={() => { setSelectedLoan(null); refreshLoans(); }} />;
      }
      return (
        <ContractPreview 
            loan={selectedLoan} 
            autoPrint={autoPrint} 
            onClose={() => { setSelectedLoan(null); setAutoPrint(false); }} 
        />
      );
  }

  // 4. Dashboard
  return (
    <ErrorBoundary>
        <div className="min-h-screen flex flex-col bg-slate-50/50">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
              <CKLogo subtitle="Prêts entre proches" />
              
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                   <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                     {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" /> : <UserIcon size={16} />}
                   </div>
                   <span className="text-sm font-bold text-slate-700">{user.name}</span>
                </div>
                
                {borrowerLoans.length > 0 && (mayLend || lenderLoans.length > 0) && (
                  <div className="hidden sm:flex bg-slate-100 p-1 rounded-xl">
                    {(['lender', 'borrower'] as const).map(v => (
                      <button key={v} onClick={() => setViewChoice(v)} className={`px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider ${currentView === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                        {v === 'lender' ? 'Mes prêts' : 'Mes emprunts'}
                      </button>
                    ))}
                  </div>
                )}

                <NotificationCenter user={user} onRefreshLoans={refreshLoans} />

                {mayLend && isProfileComplete(profile) && (
                  <button onClick={() => setEditingProfile(true)} title="Mon profil" className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <UserIcon size={20} />
                  </button>
                )}

                <button onClick={handleLogout} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <LogOut size={20} />
                </button>

                {mayLend && (
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  <PlusCircle size={20} />
                  <span className="hidden sm:inline">Créer</span>
                </button>
                )}
              </div>
            </div>
          </header>

          {/* Main Content */}
          <InstallPrompt />

          {currentView === 'borrower' ? (
            <BorrowerHome loans={borrowerLoans} user={user} loading={loadingLoans} onOpen={setSelectedLoan}
              onSwitchToLender={mayLend || lenderLoans.length > 0 ? () => setViewChoice('lender') : undefined} />
          ) : (
          <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full no-print">
            <div className="mb-8">
               <h2 className="serif text-3xl font-semibold text-slate-900">Bonjour, {(profile?.fullName || user.name).split(' ')[0]}</h2>
               <p className="text-slate-500 font-medium">Vos prêts entre proches, avec des contrats en règle.</p>
            </div>

            {inviteError && (
              <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-sm text-rose-800 flex justify-between items-start gap-4">
                <span>{inviteError} Déconnectez-vous puis reconnectez-vous avec la bonne adresse.</span>
                <button onClick={() => { setInviteError(null); setInviteId(null); clearInviteParam(); }} className="font-bold text-rose-600">OK</button>
              </div>
            )}

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-all transform group-hover:scale-110">
                  <LayoutDashboard size={120} />
                </div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Total suivi</p>
                <div className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                  {isStatsLoading ? <Loader2 className="animate-spin text-slate-300" size={32} /> : (stats.outstanding + stats.recovered).toLocaleString('fr-FR')} 
                  <span className="text-sm text-indigo-500 font-black flex flex-col leading-none"><span>€</span></span>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-b-8 border-b-amber-400">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Reste dû</p>
                <div className="text-4xl font-black text-amber-500 tracking-tighter flex items-center gap-2">
                  {isStatsLoading ? <Loader2 className="animate-spin text-amber-200" size={32} /> : stats.outstanding.toLocaleString('fr-FR')}
                  <span className="text-sm text-slate-400 font-bold">€</span>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-b-8 border-b-emerald-400">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Remboursements reçus</p>
                <div className="text-4xl font-black text-emerald-500 tracking-tighter flex items-center gap-2">
                  {isStatsLoading ? <Loader2 className="animate-spin text-emerald-200" size={32} /> : stats.recovered.toLocaleString('fr-FR')}
                  <span className="text-sm text-slate-400 font-bold">€</span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
              <div className="flex bg-slate-200/40 p-1.5 rounded-2xl w-full sm:w-auto backdrop-blur-sm overflow-x-auto">
                {(['all', 'pending', 'active', 'paid'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      activeTab === tab ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'all' ? 'Tous' : tab === 'pending' ? 'En Attente' : tab === 'active' ? 'Actifs' : 'Soldés'}
                  </button>
                ))}
              </div>
            </div>

            {/* Loan Grid */}
            {loadingLoans ? (
                 <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-indigo-600" size={40} /></div>
            ) : filteredLoans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredLoans.map(loan => (
                  <LoanCard 
                    key={loan.id} 
                    loan={loan} 
                    currentUserEmail={user.email}
                    onClick={setSelectedLoan}
                    onChanged={refreshLoans}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-slate-100 border-dashed">
                <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
                  <ShieldCheck size={48} className="text-slate-200" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Aucun prêt trouvé</h3>
                <p className="text-slate-500 mb-8 max-w-sm mx-auto">Vous n'avez aucun contrat en cours pour le moment.</p>
                {mayLend && <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
                >
                  Nouveau Contrat
                </button>}
              </div>
            )}

            {/* Obligations fiscales */}
            {lenderLoans.length > 0 && (
              <div className="mt-12"><FiscalPanel loans={loans} userEmail={user.email} /></div>
            )}

            {/* Guide Section */}
            <div className="mt-8">
              <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm">
                 <h4 className="font-black text-slate-900 text-xl mb-6 tracking-tight flex items-center gap-2">
                     <ShieldCheck className="text-indigo-500" /> Comment ça marche ?
                 </h4>
                 <div className="space-y-4">
                     {[
                       ['Rédigez', "Montant, échéancier, intérêts éventuels et clause de retard : le contrat et la reconnaissance de dette sont générés à partir d'un modèle fixe, puis vous signez."],
                       ['Envoyez le lien', "Votre ami se connecte avec l'adresse que vous avez indiquée, relit, écrit la somme en lettres et signe. Le texte signé est figé par une empreinte numérique."],
                       ['Suivez', "Il déclare ses paiements, vous les confirmez : l'échéancier, le reste dû et les éventuels intérêts de retard se mettent à jour."],
                       ['Déclarez', "Au-delà de 5 000 € prêtés à une même personne dans l'année, l'appli vous rappelle le formulaire 2062."],
                     ].map(([title, text], i) => (
                       <div key={title} className="flex items-start gap-4">
                         <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-900">{i + 1}</div>
                         <p className="text-sm text-slate-600 font-medium"><strong className="text-slate-900">{title} :</strong> {text}</p>
                       </div>
                     ))}
                 </div>
              </div>
            </div>
          </main>
          )}

          {/* Modals */}
          {isFormOpen && (
            <LoanForm 
              onClose={() => setIsFormOpen(false)} 
              user={user} 
              profile={profile}
              existingLoans={lenderLoans}
              onSuccess={refreshLoans}
              onViewContract={handleViewContract}
            />
          )}
          
          {/* Footer */}
          <footer className="bg-white border-t border-slate-100 py-16 no-print mt-auto">
            <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
              <p className="text-[10px] text-slate-400 max-w-md mx-auto leading-relaxed">
                Outil personnel de gestion de prêts occasionnels entre proches. CKMoney n'est ni une banque ni un intermédiaire et ne détient aucun fonds. Les modèles ne remplacent pas le conseil d'un professionnel du droit.
              </p>
              <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <button onClick={() => setLegalView('cgu')} className="hover:text-slate-900 transition-colors">Conditions Générales</button>
                  <button onClick={() => setLegalView('privacy')} className="hover:text-slate-900 transition-colors">Confidentialité</button>
              </div>
              <p className="text-xs text-slate-400 font-medium">© {new Date().getFullYear()} CKMoney.</p>
            </div>
          </footer>
        </div>
    </ErrorBoundary>
  );
};

export default App;
