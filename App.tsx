
import React, { useState, useEffect, useCallback, ErrorInfo, ReactNode } from 'react';
import { Loan, User } from './types';
import LoanCard from './components/LoanCard';
import LoanForm from './components/LoanForm';
import ContractPreview from './components/ContractPreview';
import BorrowerDashboard from './components/BorrowerDashboard';
import PaymentPortal from './components/PaymentPortal';
import AuthScreen from './components/AuthScreen';
import NotificationCenter from './components/NotificationCenter';
import LegalDocs from './components/LegalDocs';
import { PlusCircle, HandCoins, LayoutDashboard, ShieldCheck, User as UserIcon, LogOut, Loader2, TrendingUp } from 'lucide-react';
import { fetchExchangeRate } from './services/exchangeRate';
import { getUserLoans } from './services/loanService';
import { checkAutomaticNotifications } from './services/notificationService';

// --- 0. ERROR BOUNDARY ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

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
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ckmoney_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [loans, setLoans] = useState<Loan[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paid' | 'pending'>('all');
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false); 
  const [legalView, setLegalView] = useState<'cgu' | 'privacy' | null>(null); // State pour les pages légales
  
  // Dashboard Stats State
  const [stats, setStats] = useState({ outstanding: 0, recovered: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Sauvegarde User
  useEffect(() => {
    if (user) {
      localStorage.setItem('ckmoney_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ckmoney_user');
      setLoans([]); // Clear loans on logout
    }
  }, [user]);

  // --- 2. LOGIQUE DASHBOARD ---
  const refreshLoans = useCallback(async () => {
    if (user) {
        setLoadingLoans(true);
        try {
            const fetchedLoans = await getUserLoans(user.email);
            
            // CORRECTION DOUBLONS : Forcer l'unicité par ID
            const uniqueLoansMap = new Map();
            fetchedLoans.forEach(loan => uniqueLoansMap.set(loan.id, loan));
            const uniqueLoans = Array.from(uniqueLoansMap.values());
            
            setLoans(uniqueLoans);
            checkAutomaticNotifications(uniqueLoans, user.email);
        } catch (e) {
            console.error("Erreur refresh loans", e);
        } finally {
            setLoadingLoans(false);
        }
    }
  }, [user]);

  // Trigger refresh quand l'utilisateur change ou est défini initialement
  useEffect(() => {
    if (user) {
        refreshLoans();
    }
  }, [refreshLoans, user]);

  // Recalcul stats
  useEffect(() => {
    if (loans.length > 0) {
        const updateStats = async () => {
          setIsStatsLoading(true);
          try {
              const sumsByCurrency: Record<string, { active: number, paid: number }> = {};
              
              loans.forEach(loan => {
                if (!sumsByCurrency[loan.currency]) {
                  sumsByCurrency[loan.currency] = { active: 0, paid: 0 };
                }
                if (loan.status === 'active' || loan.status === 'repayment_pending') sumsByCurrency[loan.currency].active += loan.amount;
                else if (loan.status === 'paid') sumsByCurrency[loan.currency].paid += loan.amount;
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
  const handleLogin = (newUser: User) => {
      setUser(newUser);
      // Force refresh immédiat pas strictement nécessaire grâce au useEffect, mais sécurisant
  };
  
  const handleLogout = () => setUser(null);
  
  const handleViewContract = (loan: Loan) => {
      setIsFormOpen(false);
      setSelectedLoan(loan);
      setAutoPrint(true);
  };

  const filteredLoans = loans.filter(loan => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return loan.status === 'pending_borrower';
    return loan.status === activeTab;
  });

  // --- RENDU ---
  
  // 1. Login
  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  // 2. Pages Légales
  if (legalView) {
    return <LegalDocs view={legalView} onClose={() => setLegalView(null)} />;
  }

  // 3. Modales
  if (selectedLoan) {
      if (selectedLoan.borrowerEmail === user.email && selectedLoan.status !== 'pending_borrower') {
          return <BorrowerDashboard loan={selectedLoan} onClose={() => setSelectedLoan(null)} />;
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
              <div className="flex items-center gap-3">
                <div className="bg-slate-900 p-2.5 rounded-2xl shadow-lg">
                  <HandCoins className="text-white" size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                    CK<span className="text-indigo-600">Money</span>
                  </h1>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                   <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                     {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" /> : <UserIcon size={16} />}
                   </div>
                   <span className="text-sm font-bold text-slate-700">{user.name}</span>
                </div>
                
                <NotificationCenter user={user} onRefreshLoans={refreshLoans} />

                <button onClick={handleLogout} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <LogOut size={20} />
                </button>

                <button
                  onClick={() => setIsFormOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  <PlusCircle size={20} />
                  <span className="hidden sm:inline">Créer</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full no-print">
            <div className="mb-8">
               <h2 className="text-3xl font-bold text-slate-900">Bonjour, {user.name.split(' ')[0]} 👋</h2>
               <p className="text-slate-500 font-medium">Gérez vos prêts privés en toute sécurité.</p>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:opacity-10 transition-all transform group-hover:scale-110">
                  <LayoutDashboard size={120} />
                </div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Volume Global</p>
                <div className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                  {isStatsLoading ? <Loader2 className="animate-spin text-slate-300" size={32} /> : (stats.outstanding + stats.recovered).toLocaleString('fr-FR')} 
                  <span className="text-sm text-indigo-500 font-black flex flex-col leading-none"><span>€</span></span>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-b-8 border-b-amber-400">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Encours Actifs</p>
                <div className="text-4xl font-black text-amber-500 tracking-tighter flex items-center gap-2">
                  {isStatsLoading ? <Loader2 className="animate-spin text-amber-200" size={32} /> : stats.outstanding.toLocaleString('fr-FR')}
                  <span className="text-sm text-slate-400 font-bold">€</span>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm border-b-8 border-b-emerald-400">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Total Récupéré</p>
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
                    onClick={setSelectedLoan}
                    onMarkAsPaid={() => setPayingLoan(loan)}
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
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="inline-flex items-center gap-2 bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
                >
                  Nouveau Contrat
                </button>
              </div>
            )}

            {/* Guide Section */}
            <div className="mt-20">
              <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm">
                 <h4 className="font-black text-slate-900 text-xl mb-6 tracking-tight flex items-center gap-2">
                     <ShieldCheck className="text-indigo-500" /> Comment ça marche ?
                 </h4>
                 <div className="space-y-4">
                     <div className="flex items-center gap-4">
                         <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-900">1</div>
                         <p className="text-sm text-slate-600 font-medium"><strong className="text-slate-900">Rédigez :</strong> Remplissez les informations du prêt (Montant, date, identité) et signez.</p>
                     </div>
                     <div className="flex items-center gap-4">
                         <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-900">2</div>
                         <p className="text-sm text-slate-600 font-medium"><strong className="text-slate-900">Téléchargez :</strong> Récupérez le PDF généré automatiquement.</p>
                     </div>
                     <div className="flex items-center gap-4">
                         <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-black text-emerald-700">3</div>
                         <p className="text-sm text-slate-900 font-bold"><strong className="text-slate-900">Partagez :</strong> Envoyez le fichier à votre ami (WhatsApp, Email) pour signature manuelle.</p>
                     </div>
                 </div>
              </div>
            </div>
          </main>

          {/* Modals */}
          {isFormOpen && (
            <LoanForm 
              onClose={() => setIsFormOpen(false)} 
              user={user} 
              onSuccess={refreshLoans}
              onViewContract={handleViewContract}
            />
          )}
          
          {payingLoan && (
            <PaymentPortal 
              loan={payingLoan}
              onClose={() => setPayingLoan(null)}
              onSuccess={() => { setPayingLoan(null); refreshLoans(); }}
            />
          )}

          {/* Footer */}
          <footer className="bg-white border-t border-slate-100 py-16 no-print mt-auto">
            <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
              <div className="flex items-center justify-center gap-2 mb-6 opacity-40">
                <ShieldCheck size={20} />
                <span className="text-xs font-black uppercase tracking-[0.3em]">Certifié conforme</span>
              </div>
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
