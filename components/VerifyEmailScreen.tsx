import React, { useState } from 'react';
import { User as FirebaseUser, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { MailCheck, Loader2 } from 'lucide-react';

interface VerifyEmailScreenProps {
  firebaseUser: FirebaseUser;
  onVerified: () => void;
}

/**
 * L'accès aux prêts est réservé aux adresses email vérifiées : c'est ce qui garantit
 * que seul le véritable titulaire de l'adresse indiquée par le prêteur peut signer.
 */
const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ firebaseUser, onVerified }) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resend = async () => {
    setBusy(true);
    try {
      await sendEmailVerification(firebaseUser, { url: window.location.href });
      setMessage(`Email envoyé à ${firebaseUser.email}. Pensez à regarder dans les indésirables.`);
    } catch {
      setMessage("Envoi impossible pour le moment, réessayez dans quelques minutes.");
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    try {
      await firebaseUser.reload();
      // Rafraîchit le jeton pour que les règles Firestore voient email_verified = true
      await firebaseUser.getIdToken(true);
      if (auth.currentUser?.emailVerified) onVerified();
      else setMessage("Adresse pas encore vérifiée. Cliquez sur le lien reçu par email, puis réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MailCheck className="text-indigo-600" size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Vérifiez votre adresse</h1>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Un lien de confirmation a été envoyé à <strong>{firebaseUser.email}</strong>. Cette vérification protège vos contrats :
          seul le titulaire de l'adresse peut les consulter et les signer.
        </p>
        {message && <p className="text-xs font-bold text-indigo-700 bg-indigo-50 rounded-xl p-3 mb-4">{message}</p>}
        <div className="space-y-3">
          <button onClick={check} disabled={busy} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" /> : "J'ai cliqué sur le lien"}
          </button>
          <button onClick={resend} disabled={busy} className="w-full py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold text-sm text-slate-700">
            Renvoyer l'email
          </button>
          <button onClick={() => signOut(auth)} className="text-xs font-bold text-slate-400 hover:text-slate-600">
            Changer de compte
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailScreen;
