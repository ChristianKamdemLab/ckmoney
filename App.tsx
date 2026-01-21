
import React, { useState, useEffect } from 'react';
import { Loan, User } from './types';
import LoanCard from './components/LoanCard';
import LoanForm from './components/LoanForm';
import ContractPreview from './components/ContractPreview';
import PaymentPortal from './components/PaymentPortal';
import AuthScreen from './components/AuthScreen';
import { PlusCircle, HandCoins, Info, LayoutDashboard, ShieldCheck, TrendingUp, CreditCard, LogOut, User as UserIcon, Loader2 } from 'lucide-react';
import { fetchExchangeRate } from './services/exchangeRate';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paid'>('all');
  
  // Dashboard Stats State
  const [stats, setStats] = useState({ outstanding: 0, recovered: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Load User from LocalStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('ckmoney_user');
    if (savedUser) {
      try {
         setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to load user", e);
      }
    }
  }, []);

  // Save User to LocalStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('ckmoney_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ckmoney_user');
    }
  }, [user]);

  // Persist loans to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ckmoney_loans');
    if (saved) {
      try {
        setLoans(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load loans", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ckmoney_loans', JSON.stringify(loans));
  }, [loans]);

  // Recalculate stats with currency conversion whenever loans change
  useEffect(() => {
    const updateStats = async () => {
      setIsStatsLoading(true);
      const sumsByCurrency: Record<string, { active: number, paid: number }> = {};
      
      // Group by currency first to minimize API calls
      loans.forEach(loan => {
        if (!sumsByCurrency[loan.currency]) {
          sumsByCurrency[loan.currency] = { active: 0, paid: 0 };
        }
        if (loan.status === 'active') sumsByCurrency[loan.currency].active += loan.amount;
        else sumsByCurrency[loan.currency].paid += loan.amount;
      });

      let totalOutstanding = 0;
      let totalRecovered = 0;

      // Fetch rates and convert to EUR
      await Promise.all(Object.keys(sumsByCurrency).map(async (currency) => {
        const { active, paid } = sumsByCurrency[currency];
        if (active > 0) totalOutstanding += await fetchExchangeRate(active, currency);
        if (paid > 0) totalRecovered += await fetchExchangeRate(paid, currency);
      }));

      setStats({ outstanding: totalOutstanding, recovered: totalRecovered });
      setIsStatsLoading(false);
    };

    updateStats();
  }, [loans]);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleAddLoan = (newLoan: Loan) => {
    setLoans([newLoan, ...loans]);
    setIsFormOpen(false);
  };

  const handleMarkAsPaid = (id: string) => {
    setLoans(loans.map(l => l.id === id ? { ...l, status: 'paid' as const } : l));
    setPayingLoan(null);
  };

  const filteredLoans = loans.filter(loan => {
    if (activeTab === 'all') return true;
    return loan.status === activeTab;
  });

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
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
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mt-1">by Christian KAMDEM</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
               <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                 {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full" /> : <UserIcon size={16} />}
               </div>
               <span className="text-sm font-bold text-slate-700">{user.name}</span>
            </div>

            <button 
              onClick={handleLogout}
              className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              title="Se déconnecter"
            >
              <LogOut size={20} />
            </button>

            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
            >
              <PlusCircle size={20} />
              <span className="hidden sm:inline">Nouveau Prêt</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full no-print">
        {/* Welcome Message */}
        <div className="mb-8">
           <h2 className="text-3xl font-bold text-slate-900">Bonjour, {user.name.split(' ')[0]} 👋</h2>
           <p className="text-slate-500 font-medium">Gérez vos prêts et sécurisez vos transactions.</p>
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
              <span className="text-sm text-indigo-500 font-black flex flex-col leading-none">
                <span>€</span>
                <span className="text-[8px] text-slate-300 font-bold uppercase tracking-wider">Estimé</span>
              </span>
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
          <div className="flex bg-slate-200/40 p-1.5 rounded-2xl w-full sm:w-auto backdrop-blur-sm">
            {(['all', 'active', 'paid'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab 
                  ? 'bg-white text-slate-900 shadow-lg' 
                  : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab === 'all' ? 'Historique' : tab === 'active' ? 'En Cours' : 'Clôturés'}
              </button>
            ))}
          </div>
        </div>

        {/* Loan Grid */}
        {filteredLoans.length > 0 ? (
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
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Aucun prêt enregistré</h3>
            <p className="text-slate-500 mb-10 max-w-sm mx-auto font-medium">Commencez à sécuriser vos transactions avec vos amis dès maintenant.</p>
            <button
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
            >
              Nouveau Contrat
            </button>
          </div>
        )}

        {/* Payment Methods Info */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-100 relative overflow-hidden">
             <div className="relative z-10">
               <h4 className="font-black text-2xl mb-4 tracking-tight">Paiement Intelligent</h4>
               <p className="text-indigo-100 leading-relaxed font-medium">
                 Notre système détecte automatiquement le taux de change actuel. Les remboursements sont automatiquement convertis en Euros pour simplifier votre comptabilité.
               </p>
             </div>
             <TrendingUp className="absolute -bottom-6 -right-6 text-white/10 w-48 h-48" />
          </div>
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm flex items-center gap-8">
            <div className="flex -space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border-4 border-white flex items-center justify-center shadow-lg">
                <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" className="w-8" alt="PP" />
              </div>
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border-4 border-white flex items-center justify-center shadow-lg text-white">
                <CreditCard size={24} />
              </div>
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-lg mb-1 tracking-tight">Connecté à vos banques</h4>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">
                Vos emprunteurs peuvent lier PayPal ou leur compte bancaire pour des remboursements en un clic.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {isFormOpen && (
        <LoanForm 
          onClose={() => setIsFormOpen(false)} 
          onSubmit={handleAddLoan} 
          lenderName={user.name} 
        />
      )}
      
      {selectedLoan && (
        <ContractPreview loan={selectedLoan} onClose={() => setSelectedLoan(null)} />
      )}

      {payingLoan && (
        <PaymentPortal 
          amount={payingLoan.amount} 
          currency={payingLoan.currency}
          onClose={() => setPayingLoan(null)}
          onSuccess={() => handleMarkAsPaid(payingLoan.id)}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-16 no-print mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6 opacity-40">
            <ShieldCheck size={20} />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Certifié conforme</span>
          </div>
          <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">CKMoney Secure Infrastructure</p>
          <p className="text-xs text-slate-400 font-medium">
            Développé par Christian KAMDEM. Solutions de gestion de dettes privées. &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
