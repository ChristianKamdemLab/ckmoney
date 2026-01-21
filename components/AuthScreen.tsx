
import React, { useState } from 'react';
import { User } from '../types';
import { HandCoins, ArrowRight, Loader2, AlertCircle, WifiOff } from 'lucide-react';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, googleProvider } from "../services/firebase";

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showOfflineOption, setShowOfflineOption] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleOfflineLogin = () => {
      onLogin({
        id: 'local_' + Date.now(),
        name: formData.name || 'Utilisateur Local',
        email: formData.email || 'offline@ckmoney.app',
        avatar: `https://ui-avatars.com/api/?name=${formData.name || 'Local'}&background=slate&color=white`
     });
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    setShowOfflineOption(false);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      onLogin({
        id: user.uid,
        name: user.displayName || 'Utilisateur Google',
        email: user.email || '',
        avatar: user.photoURL || undefined
      });
    } catch (error: any) {
      console.error("Google Auth Error:", error);
      
      let msg = "Erreur de connexion Google.";
      
      // Messages simplifiés pour l'utilisateur final (plus de détails techniques visibles)
      if (error.code === 'auth/unauthorized-domain') {
         msg = "Authentification indisponible sur ce domaine.";
      } else if (error.code === 'auth/operation-not-allowed') {
          msg = "Service d'authentification temporairement indisponible.";
      } else if (error.code === 'auth/popup-closed-by-user') {
         msg = "Connexion annulée.";
      } else if (error.code === 'auth/popup-blocked') {
         msg = "Fenêtre de connexion bloquée par le navigateur.";
      } else if (error.code === 'auth/network-request-failed') {
         msg = "Erreur de connexion réseau.";
      }

      setErrorMsg(msg);
      setLoading(false);
      // On affiche le bouton "Mode Secours" uniquement si une erreur survient, 
      // pour permettre à l'utilisateur de tester quand même s'il le souhaite activement.
      setShowOfflineOption(true);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setShowOfflineOption(false);

    try {
        let user;
        if (isLogin) {
            // Connexion Réelle
            const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
            user = userCredential.user;
        } else {
            // Inscription Réelle
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            user = userCredential.user;
            // Mise à jour du nom
            if (formData.name) {
                await updateProfile(user, { displayName: formData.name });
            }
        }

        onLogin({
            id: user.uid,
            name: user.displayName || formData.name || user.email?.split('@')[0] || 'Utilisateur',
            email: user.email || formData.email,
            avatar: user.photoURL || undefined
        });

    } catch (error: any) {
        console.error("Auth Error", error);
        
        let msg = "Une erreur est survenue.";
        if (error.code === 'auth/wrong-password') msg = "Mot de passe incorrect.";
        else if (error.code === 'auth/user-not-found') msg = "Compte introuvable.";
        else if (error.code === 'auth/email-already-in-use') msg = "Email déjà utilisé.";
        else if (error.code === 'auth/weak-password') msg = "Mot de passe trop court (6 car. min).";
        else if (error.code === 'auth/invalid-email') msg = "Email invalide.";
        else if (error.code === 'auth/network-request-failed' || error.code === 'auth/internal-error') {
            msg = "Erreur de connexion au serveur.";
            setShowOfflineOption(true);
        }
        
        setErrorMsg(msg);
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="bg-slate-900 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-slate-200">
          <HandCoins className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-none mb-1">
          CK<span className="text-indigo-600">Money</span>
        </h1>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">By Christian Kamdem</p>
      </div>

      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="p-8">
          <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl mb-8">
            <button
              onClick={() => { setIsLogin(true); setErrorMsg(null); setShowOfflineOption(false); }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${isLogin ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Connexion
            </button>
            <button
              onClick={() => { setIsLogin(false); setErrorMsg(null); setShowOfflineOption(false); }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${!isLogin ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Inscription
            </button>
          </div>

          <div className="space-y-4">
            {errorMsg && (
              <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl flex flex-col gap-2 border border-rose-100 animate-in fade-in">
                <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                </div>
                {showOfflineOption && (
                    <button 
                        onClick={handleOfflineLogin}
                        className="mt-2 w-full py-2 bg-rose-100 text-rose-700 rounded-lg text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-rose-200 transition-colors"
                    >
                        <WifiOff size={14} /> Mode Hors Ligne (Test)
                    </button>
                )}
              </div>
            )}

            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-all group relative overflow-hidden"
            >
              {loading ? <Loader2 className="animate-spin text-slate-400" /> : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="font-bold text-slate-700 group-hover:text-slate-900">Continuer avec Google</span>
                </>
              )}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold tracking-widest">Ou par email</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-900 ml-1">Nom complet</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                    placeholder="Votre Prénom et Nom"
                  />
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-900 ml-1">Adresse Email</label>
                <input 
                  type="email" 
                  required 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                  placeholder="exemple@email.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-900 ml-1">Mot de passe</label>
                <input 
                  type="password" 
                  required 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full p-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 mt-4"
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    {isLogin ? 'Se connecter' : "S'inscrire"} <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-xs text-slate-400 font-medium max-w-xs text-center leading-relaxed">
        En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité. 
        <br/>Plateforme sécurisée par CKMoney.
      </p>
    </div>
  );
};

export default AuthScreen;
