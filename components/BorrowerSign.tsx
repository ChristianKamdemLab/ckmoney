import React, { useEffect, useState } from 'react';
import { Loan, User } from '../types';
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, PenLine, ShieldCheck } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { amountWordsMatch, parseFrenchAmountWords } from '../utils/frenchNumbers';
import { sha256Hex } from '../utils/contract';
import { scheduleForLoan, formatMoney, parseISODate } from '../utils/schedule';
import { signAsBorrower } from '../services/loanService';
import { LEGAL_INTEREST_RATE } from '../config/legal';

interface BorrowerSignProps {
  loan: Loan;
  user: User;
  onClose: () => void;
  onSigned: () => void;
}

const fmt = (iso: string) => parseISODate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const BorrowerSign: React.FC<BorrowerSignProps> = ({ loan, user, onClose, onSigned }) => {
  const [amountWords, setAmountWords] = useState('');
  const [signedName, setSignedName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [signature, setSignature] = useState('');
  const [integrity, setIntegrity] = useState<'checking' | 'ok' | 'ko'>('checking');
  const [currentHash, setCurrentHash] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullText = (loan.contractText || '') + '\n\n' + (loan.acknowledgmentText || '');
  useEffect(() => {
    sha256Hex(fullText).then(h => {
      setCurrentHash(h);
      setIntegrity(h === loan.contractHash ? 'ok' : 'ko');
    });
  }, [fullText, loan.contractHash]);

  const schedule = scheduleForLoan(loan);
  const total = schedule.reduce((s, i) => s + i.amount, 0);
  const wordsOk = amountWordsMatch(amountWords, loan.amount);
  const parsed = parseFrenchAmountWords(amountWords);
  const nameOk = signedName.trim().length >= 3;
  const canSign = wordsOk && nameOk && accepted && !!signature && integrity === 'ok' && !saving;

  const lateText = loan.lateRateMode === 'none'
    ? 'aucune pénalité conventionnelle'
    : loan.lateRateMode === 'legal'
      ? `intérêt au taux légal (${LEGAL_INTEREST_RATE.toLocaleString('fr-FR')} % par an aujourd'hui)`
      : `${(loan.lateInterestRate || 0).toLocaleString('fr-FR')} % par an sur les sommes en retard`;

  const handleSign = async () => {
    if (!canSign) return;
    setSaving(true);
    setError(null);
    try {
      await signAsBorrower(loan, { amountWords, signedName, signature, hash: currentHash, uid: user.id });
      onSigned();
    } catch (e) {
      console.error(e);
      setError("La signature n'a pas pu être enregistrée. Vérifiez que vous êtes connecté avec l'adresse indiquée par le prêteur, puis réessayez.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-24">
        <button onClick={onClose} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm">
          <ArrowLeft size={18} /> Retour
        </button>

        <div className="bg-slate-900 text-white rounded-[2rem] p-6 sm:p-8 mb-6">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Contrat à signer</p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-4">
            {loan.lenderName} vous prête {formatMoney(loan.amount, loan.currency)}
          </h1>
          <ul className="text-sm text-slate-300 space-y-1.5">
            <li>• {loan.interestRate ? `Intérêts : ${loan.interestRate.toLocaleString('fr-FR')} % par an, soit ${formatMoney(total - loan.amount, loan.currency)} au total` : 'Sans intérêt'}</li>
            <li>• {schedule.length > 1
              ? `${schedule.length} mensualités de ${formatMoney(schedule[0].amount, loan.currency)}, du ${fmt(schedule[0].dueDate)} au ${fmt(schedule[schedule.length - 1].dueDate)}`
              : `Remboursement de ${formatMoney(total, loan.currency)} au plus tard le ${fmt(schedule[0].dueDate)}`}</li>
            <li>• En cas de retard : {lateText}</li>
            <li>• Remboursement anticipé possible à tout moment, sans frais</li>
          </ul>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-black text-slate-900 mb-3">1. Lisez le contrat</h2>
          <div className="max-h-96 overflow-y-auto p-4 bg-slate-50 rounded-xl text-sm text-slate-700 whitespace-pre-wrap leading-relaxed serif">
            {fullText}
          </div>
          <p className={`mt-3 text-[11px] font-bold flex items-center gap-1 ${integrity === 'ok' ? 'text-emerald-600' : integrity === 'ko' ? 'text-rose-600' : 'text-slate-400'}`}>
            <ShieldCheck size={14} />
            {integrity === 'ok' && 'Texte intègre : identique à celui signé par le prêteur.'}
            {integrity === 'ko' && 'Le texte ne correspond pas à l’empreinte enregistrée. Ne signez pas et prévenez le prêteur.'}
            {integrity === 'checking' && 'Vérification de l’intégrité du texte…'}
          </p>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 mb-6 space-y-4">
          <h2 className="font-black text-slate-900">2. Écrivez vous-même la somme en toutes lettres</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            C'est la mention exigée par l'article 1376 du Code civil : elle prouve que vous savez exactement combien vous devez.
            Tapez-la vous-même, sans copier-coller, par exemple « mille deux cents euros ».
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 shrink-0">Bon pour la somme de</span>
          </div>
          <input
            value={amountWords}
            onChange={e => setAmountWords(e.target.value)}
            onPaste={e => e.preventDefault()}
            placeholder="… en lettres"
            className={`w-full px-4 py-3 rounded-xl border-2 outline-none font-medium ${amountWords ? (wordsOk ? 'border-emerald-400' : 'border-rose-300') : 'border-slate-200'}`}
          />
          {amountWords && (
            <p className={`text-xs font-bold flex items-center gap-1 ${wordsOk ? 'text-emerald-600' : 'text-rose-600'}`}>
              {wordsOk ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {wordsOk
                ? `Concorde avec ${formatMoney(loan.amount, loan.currency)}.`
                : parsed !== null
                  ? `Vous avez écrit ${parsed.toLocaleString('fr-FR')}, le montant prêté est ${loan.amount.toLocaleString('fr-FR')}.`
                  : 'Montant illisible : écrivez-le uniquement en lettres.'}
            </p>
          )}
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 mb-6 space-y-4">
          <h2 className="font-black text-slate-900">3. Signez</h2>
          <input
            value={signedName}
            onChange={e => setSignedName(e.target.value)}
            placeholder="Votre prénom et nom"
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 outline-none font-medium"
          />
          <SignaturePad label="Signez dans le cadre" onSave={setSignature} />
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 w-4 h-4 accent-indigo-600" />
            <span className="text-xs text-slate-600 leading-relaxed">
              Lu et approuvé. J'accepte le contrat de prêt et je reconnais devoir {formatMoney(loan.amount, loan.currency)} à {loan.lenderName}.
              Je suis connecté(e) avec mon adresse {user.email}.
            </span>
          </label>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <button
            onClick={handleSign}
            disabled={!canSign}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${canSign ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
          >
            {saving ? <Loader2 className="animate-spin" /> : <><PenLine size={18} /> Signer le contrat</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BorrowerSign;
