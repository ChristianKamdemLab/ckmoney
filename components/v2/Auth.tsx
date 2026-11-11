import React, { useState } from 'react';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider } from '../../services/firebase';
import { Screen, TopBar, Button, Field, inputClass, inputStyle, Note, C } from './ui';
import CKLogo from '../brand/CKLogo';

const errorText = (code: string) => ({
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cet e-mail.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
  'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/network-request-failed': 'Pas de connexion. Réessaie.',
} as Record<string, string>)[code] ?? 'Connexion impossible. Réessaie.';

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** Connexion : Google en un geste, ou e-mail et mot de passe. */
const Auth: React.FC<{ context?: string; onBack?: () => void }> = ({ context, onBack }) => {
  const [mode, setMode] = useState<'choice' | 'login' | 'signup'>('choice');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const google = async () => {
    setBusy('g'); setError(null);
    try { await signInWithPopup(auth, googleProvider); }
    catch (e: any) { const t = errorText(e.code); if (t) setError(t); }
    finally { setBusy(null); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('e'); setError(null); setInfo(null);
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email.trim(), password);
      else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (e: any) { setError(errorText(e.code)); }
    finally { setBusy(null); }
  };

  const reset = async () => {
    if (!email.trim()) { setError('Indique ton e-mail, puis appuie de nouveau.'); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); setInfo('E-mail de réinitialisation envoyé.'); setError(null); }
    catch (e: any) { setError(errorText(e.code)); }
  };

  if (mode === 'choice') return (
    <Screen>
      {onBack ? <TopBar onBack={onBack} /> : <div className="h-6" />}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <CKLogo size="lg" subtitle="Une app CKLabs" />
        <h1 className="text-[28px] leading-tight font-bold mt-10 max-w-[320px]">{context || 'Le Jambo n’aime pas la panique.'}</h1>
        <p className="text-[13px] mt-3 leading-snug max-w-[280px]" style={{ color: C.mute }}>
          {context ? 'Tes informations ne sont visibles que par toi et la personne avec qui tu fais le prêt.' : 'Demander, prêter, rembourser entre proches\u00a0: avec un vrai contrat et sans avoir à relancer.'}
        </p>
      </div>
      <div className="px-5 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">
        {error && <Note tone="danger">{error}</Note>}
        <button onClick={google} disabled={!!busy} className="h-14 rounded-2xl flex items-center justify-center gap-3 text-base font-bold bg-white border-[1.5px] disabled:opacity-60" style={{ borderColor: C.border, color: C.ink }}>
          <GoogleMark /> {busy === 'g' ? 'Connexion…' : 'Continuer avec Google'}
        </button>
        <Button variant="secondary" onClick={() => { setMode('signup'); setError(null); }}>Continuer avec un e-mail</Button>
      </div>
    </Screen>
  );

  return (
    <Screen>
      <TopBar onBack={() => { setMode('choice'); setError(null); setInfo(null); }} />
      <div className="px-6 pt-2">
        <h1 className="text-[26px] font-bold">{mode === 'signup' ? 'Créer ton compte' : 'Te connecter'}</h1>
        <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null); }} className="text-[15px] font-semibold mt-1" style={{ color: C.ochreText }}>
          {mode === 'signup' ? "J'ai déjà un compte" : 'Je n’ai pas de compte'}
        </button>
      </div>
      <form onSubmit={submit} className="px-6 pt-6 flex flex-col gap-4 flex-1">
        {mode === 'signup' && (
          <Field label="Prénom" htmlFor="nm"><input id="nm" autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} className={inputClass} style={inputStyle} /></Field>
        )}
        <Field label="E-mail" htmlFor="em"><input id="em" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} style={inputStyle} /></Field>
        <Field label="Mot de passe" htmlFor="pw" hint={mode === 'signup' ? '6 caractères minimum' : undefined}>
          <input id="pw" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} style={inputStyle} />
        </Field>
        {mode === 'login' && <button type="button" onClick={reset} className="text-sm font-semibold text-left" style={{ color: C.ink }}>Mot de passe oublié ?</button>}
        {error && <Note tone="danger">{error}</Note>}
        {info && <Note tone="ok">{info}</Note>}
        <div className="mt-auto pb-[max(env(safe-area-inset-bottom),24px)]">
          <Button type="submit" busy={busy === 'e'}>{mode === 'signup' ? 'Créer mon compte' : 'Me connecter'}</Button>
        </div>
      </form>
    </Screen>
  );
};

export default Auth;
