import React, { useEffect, useMemo, useState } from 'react';
import { Loan, Notification, Profile, User, ReceiveInfo, isIdentityComplete } from '../../types';
import {
  Screen, TopBar, H1, Amount, Button, Card, KV, Avatar, Chips, Field, inputClass, inputStyle, Note, Footer, Sheet, Toast, Icon, Skeleton,
  C, euro, euro2, firstName, dateFr, relDays,
} from './ui';
import CKLogo from '../brand/CKLogo';
import PushCard from './PushCard';
import ReceiveFields, { receiveValid } from './ReceiveFields';
import CityInput from '../CityInput';
import SignaturePad from '../SignaturePad';
import ContractPreview from '../ContractPreview';
import { mergeProfile } from '../../services/profileService';
import {
  BorrowerIdentity, Terms, signOffer, createRequest, previewTexts, scheduleSummary, LenderCard, getLenderCard, payUrl,
} from '../../services/loanService';
import { getUserNotifications, markNotificationAsRead } from '../../services/notificationService';
import { amountWordsMatch } from '../../utils/frenchNumbers';
import { buildSchedule, computeSituation, toISODate, addMonths } from '../../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../../config/legal';

const identityOf = (p: Partial<Profile> | null | undefined, user: User): BorrowerIdentity => ({
  civility: p?.civility || 'M.',
  fullName: p?.fullName || (user.name.includes(' ') ? user.name : ''),
  birthDate: p?.birthDate || '',
  birthPlace: p?.birthPlace || '',
  address: p?.address || '',
});

// ---------------------------------------------------------------------------
// Avant connexion : ce que voit l'ami en ouvrant un lien WhatsApp
// ---------------------------------------------------------------------------

export const Landing: React.FC<{
  eyebrow: string; title: React.ReactNode; amount?: string; rows?: [React.ReactNode, React.ReactNode][];
  bullets?: string[]; cta: string; onContinue: () => void;
}> = ({ eyebrow, title, amount, rows, bullets, cta, onContinue }) => (
  <Screen>
    <div className="px-6 pt-[max(env(safe-area-inset-top),24px)]"><CKLogo size="sm" /></div>
    <div className="px-6 pt-10" style={{ animation: 'fadeUp .3s ease-out' }}>
      <div className="text-sm font-semibold" style={{ color: C.ochreText }}>{eyebrow}</div>
      <h1 className="text-[28px] leading-tight font-bold mt-1.5">{title}</h1>
      {amount && <div className="mt-3"><Amount size={48}>{amount}</Amount></div>}
    </div>
    {rows && <div className="px-6 pt-6"><KV rows={rows} /></div>}
    {bullets && (
      <div className="px-6 pt-6 flex flex-col gap-3">
        {bullets.map((b, i) => (
          <div key={i} className="flex gap-3 items-start text-[15px] leading-snug">
            <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[13px] font-bold" style={{ background: C.ochreSoft, color: C.ochreText }}>{i + 1}</span>
            <span className="pt-0.5">{b}</span>
          </div>
        ))}
      </div>
    )}
    <Footer>
      <Button onClick={onContinue}>{cta}</Button>
      <div className="text-xs text-center mt-3" style={{ color: C.mute }}>Connexion avec Google ou e-mail. Tes informations restent entre vous deux.</div>
    </Footer>
  </Screen>
);

// ---------------------------------------------------------------------------
// Identité : saisie une seule fois, enregistrée dans le profil
// ---------------------------------------------------------------------------

const IdentityStep: React.FC<{
  user: User; profile: Partial<Profile> | null; progress: [number, number]; onBack: () => void; onDone: (b: BorrowerIdentity) => void;
}> = ({ user, profile, progress, onBack, onDone }) => {
  const [b, setB] = useState<BorrowerIdentity>(identityOf(profile, user));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = isIdentityComplete(b) && b.fullName.trim().includes(' ');
  const save = async () => {
    setBusy(true); setErr(null);
    try { await mergeProfile(user.id, { ...b, fullName: b.fullName.trim(), address: b.address.trim(), updatedAt: new Date().toISOString() }); onDone(b); }
    catch (e) { console.error(e); setErr("Enregistrement impossible, réessaie."); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <TopBar onBack={onBack} progress={progress} />
      <H1 desc="Ces informations figurent sur le contrat. Tu ne les donnes qu'une fois : la prochaine fois, tu signeras directement.">Qui es-tu ?</H1>
      <div className="px-6 pt-5 flex flex-col gap-4">
        <Chips options={[{ id: 'M.', label: 'M.' }, { id: 'Mme', label: 'Mme' }]} value={b.civility} onChange={v => setB({ ...b, civility: v as 'M.' | 'Mme' })} />
        <Field label="Prénom et nom" htmlFor="fn" hint={b.fullName && !b.fullName.trim().includes(' ') ? 'Indique ton prénom et ton nom.' : undefined}>
          <input id="fn" autoComplete="name" value={b.fullName} onChange={e => setB({ ...b, fullName: e.target.value })} className={inputClass} style={inputStyle} placeholder="Charles André" />
        </Field>
        <Field label="Date de naissance" htmlFor="bd">
          <input id="bd" type="date" value={b.birthDate} max={toISODate(new Date())} onChange={e => setB({ ...b, birthDate: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <CityInput label="Lieu de naissance" value={b.birthPlace} onChange={v => setB({ ...b, birthPlace: v })} required />
        <Field label="Adresse" htmlFor="ad">
          <input id="ad" autoComplete="street-address" value={b.address} onChange={e => setB({ ...b, address: e.target.value })} className={inputClass} style={inputStyle} placeholder="12 rue de la Paix, 75002 Paris" />
        </Field>
        {err && <Note tone="danger">{err}</Note>}
      </div>
      <Footer><Button disabled={!ok} busy={busy} onClick={save}>Continuer</Button></Footer>
    </Screen>
  );
};

// ---------------------------------------------------------------------------
// Signature : mention du montant en lettres (art. 1376 C. civ.) et signature
// ---------------------------------------------------------------------------

const SignStep: React.FC<{
  amount: number; currency: string; progress: [number, number]; title: string; sub: string; cta: string;
  busy: boolean; error: string | null; onBack: () => void; onPreview?: () => void;
  onSign: (words: string, signature: string) => void;
}> = ({ amount, currency, progress, title, sub, cta, busy, error, onBack, onPreview, onSign }) => {
  const [words, setWords] = useState('');
  const [sig, setSig] = useState('');
  const match = words.trim().length > 3 && amountWordsMatch(words, amount);
  return (
    <Screen>
      <TopBar onBack={onBack} progress={progress} />
      <H1 desc={sub}>{title}</H1>
      <div className="px-6 pt-5 flex flex-col gap-4">
        <Field label={`Écris le montant en lettres (${euro2(amount, currency)})`} htmlFor="w"
          hint={words.trim().length > 3 && !match ? 'Le montant écrit ne correspond pas encore.' : undefined}>
          <div className="relative">
            <input id="w" value={words} onChange={e => setWords(e.target.value)} autoCapitalize="none" autoComplete="off"
              className={inputClass} style={{ ...inputStyle, borderColor: match ? C.green : inputStyle.borderColor, paddingRight: 44 }}
              placeholder="ex. cent cinquante euros" />
            {match && <span className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: C.green }}><Icon name="check" size={20} /></span>}
          </div>
        </Field>
        <div>
          <div className="text-[13px] font-semibold mb-1.5" style={{ color: C.text2 }}>Ta signature</div>
          <SignaturePad label="Signe avec le doigt dans le cadre" onSave={setSig} />
        </div>
        {onPreview && (
          <button onClick={onPreview} className="text-[14px] font-semibold text-left flex items-center gap-1.5" style={{ color: C.ink }}>
            <Icon name="file" size={18} /> Lire le contrat complet
          </button>
        )}
        <Note>En signant, tu reconnais devoir cette somme et t'engages à la rembourser selon l'échéancier. C'est un vrai contrat.</Note>
        {error && <Note tone="danger">{error}</Note>}
      </div>
      <Footer><Button disabled={!match || !sig} busy={busy} onClick={() => onSign(words, sig)}>{cta}</Button></Footer>
    </Screen>
  );
};

const Done: React.FC<{ title: string; sub: React.ReactNode; children?: React.ReactNode }> = ({ title, sub, children }) => (
  <Screen>
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8" style={{ animation: 'fadeUp .3s ease-out' }}>
      <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: C.greenSoft, color: C.green }}><Icon name="check" size={32} /></span>
      <h1 className="text-[26px] font-bold mt-5">{title}</h1>
      <p className="text-[15px] mt-2 leading-relaxed" style={{ color: C.mute }}>{sub}</p>
    </div>
    <Footer><div className="flex flex-col gap-2.5">{children}</div></Footer>
  </Screen>
);

// ---------------------------------------------------------------------------
// L'ami signe l'offre du prêteur
// ---------------------------------------------------------------------------

export const BorrowerSignFlow: React.FC<{
  loan: Loan; user: User; profile: Profile | null; onBack: () => void; onDone: () => void; onProfileChanged: () => void;
}> = ({ loan, user, profile, onBack, onDone, onProfileChanged }) => {
  const needsIdentity = !isIdentityComplete(profile);
  const total = needsIdentity ? 3 : 2;
  const [step, setStep] = useState<'offer' | 'identity' | 'sign' | 'done'>('offer');
  const [identity, setIdentity] = useState<BorrowerIdentity>(identityOf(profile, user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Loan | null>(null);
  const lender = firstName(loan.lenderName);
  const s = loan.schedule || [];
  const todayISO = toISODate(new Date());
  const overdueFrom = s.find(i => i.dueDate < todayISO)?.dueDate;
  const lateRateNum = loan.lateRateMode === 'legal' ? LEGAL_INTEREST_RATE : (loan.lateInterestRate || 0);
  const [payLinkUrl, setPayLinkUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!overdueFrom || !loan.lenderUid) return;
    getLenderCard(loan.lenderUid).then(c => {
      const sit = computeSituation(loan, LEGAL_INTEREST_RATE);
      setPayLinkUrl(payUrl(c?.paymentLink || loan.lenderPaymentLink, Math.round((sit.overdueAmount + sit.lateInterest) * 100) / 100, loan.currency));
    });
  }, [loan.id]);

  if (preview) return <ContractPreview loan={preview} onClose={() => setPreview(null)} />;

  if (step === 'offer') return (
    <Screen>
      <TopBar onBack={onBack} progress={[1, total]} />
      <div className="px-6 pt-2 flex items-center gap-3.5">
        <Avatar name={lender} size={52} />
        <div>
          <div className="text-[15px] font-semibold">{lender} te prête</div>
          <Amount size={40}>{euro2(loan.amount, loan.currency)}</Amount>
        </div>
      </div>
      <div className="px-6 pt-5">
        <KV rows={[
          ['Remboursement', s.length > 1 ? `${s.length} × ${euro2(s[0].amount, loan.currency)}` : `${euro2(s[0]?.amount || loan.amount, loan.currency)} en une fois`],
          [s.length > 1 ? 'Échéances' : 'Date', s.length > 1 ? `du ${dateFr(s[0].dueDate, { day: 'numeric', month: 'short' })} au ${dateFr(s[s.length - 1].dueDate, { day: 'numeric', month: 'short' })}` : dateFr(s[0]?.dueDate || loan.repaymentDate)],
          ['Intérêts', loan.interestRate ? `${loan.interestRate.toLocaleString('fr-FR')} % par an` : 'Aucun'],
          ['En cas de retard', loan.lateRateMode === 'none' ? 'Pas de pénalité' : loan.lateRateMode === 'legal' ? `Taux légal, ${LEGAL_INTEREST_RATE.toLocaleString('fr-FR')} % par an` : `${(loan.lateInterestRate || 0).toLocaleString('fr-FR')} % par an`],
        ]} />
      </div>
      <div className="px-6 pt-4">
        {overdueFrom ? (
          <Note tone="warn">
            Le remboursement était prévu le {dateFr(overdueFrom, { day: 'numeric', month: 'long' })}. En signant, tu reconnais devoir cette somme.
            Tu pourras ensuite rembourser tout de suite, ou proposer une nouvelle date à {lender}
            {loan.lateRateMode !== 'none' ? <> : les intérêts de retard ({lateRateNum.toLocaleString('fr-FR')} % par an) courent alors depuis le {dateFr(overdueFrom, { day: 'numeric', month: 'long' })} jusqu'au paiement</> : null}.
          </Note>
        ) : <Note>Tu peux rembourser plus tôt, sans frais. Si tu as besoin de plus de temps, tu pourras demander un délai depuis l'appli.</Note>}
      </div>
      <Footer><Button onClick={() => setStep(needsIdentity ? 'identity' : 'sign')}>Continuer</Button></Footer>
    </Screen>
  );

  if (step === 'identity') return (
    <IdentityStep user={user} profile={profile} progress={[2, total]} onBack={() => setStep('offer')}
      onDone={b => { setIdentity(b); onProfileChanged(); setStep('sign'); }} />
  );

  if (step === 'sign') return (
    <SignStep amount={loan.amount} currency={loan.currency} progress={[total, total]}
      title="Signe le contrat" sub={`${lender} a déjà signé de son côté. Il ne manque que toi.`} cta="Signer"
      busy={busy} error={error} onBack={() => setStep(needsIdentity ? 'identity' : 'offer')}
      onPreview={async () => {
        const t = await previewTexts(loan, identity);
        setPreview({ ...loan, borrowerName: identity.fullName, borrowerCivility: identity.civility, borrowerBirthDate: identity.birthDate, borrowerBirthPlace: identity.birthPlace, borrowerAddress: identity.address, ...t });
      }}
      onSign={async (words, sig) => {
        setBusy(true); setError(null);
        try {
          await signOffer(loan, user, identity, { amountWords: words, signature: sig });
          mergeProfile(user.id, { signature: sig }).catch(() => undefined);
          setStep('done');
        } catch (e) { console.error(e); setError("La signature n'a pas pu être enregistrée. Réessaie."); }
        finally { setBusy(false); }
      }} />
  );

  return (
    <Done title="C'est signé" sub={overdueFrom
      ? <>{lender} est prévenu. Le remboursement est en retard : règle-le maintenant, ou propose une nouvelle date avec le bouton « Délai » de ton prêt.</>
      : <>{lender} est prévenu. Tu retrouves ton prêt, tes échéances et le contrat dans ton espace.</>}>
      {overdueFrom && payLinkUrl && (
        <a href={payLinkUrl} target="_blank" rel="noopener noreferrer" className="h-14 rounded-2xl flex items-center justify-center text-base font-bold text-white" style={{ background: C.ink }}>Payer maintenant</a>
      )}
      <Button variant={overdueFrom && payLinkUrl ? 'secondary' : 'primary'} onClick={onDone}>{overdueFrom ? 'Proposer une nouvelle date' : 'Voir mon espace'}</Button>
    </Done>
  );
};

// ---------------------------------------------------------------------------
// L'ami fait une demande de prêt (il propose l'échéancier)
// ---------------------------------------------------------------------------

const nextFriday = () => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return toISODate(d); };
const endOfMonth = () => { const d = new Date(); return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };

export const RequestFlow: React.FC<{
  user: User; profile: Profile | null; lenderUid: string; lenderFirstName: string;
  onBack: () => void; onDone: () => void; onProfileChanged: () => void;
}> = ({ user, profile, lenderUid, lenderFirstName, onBack, onDone, onProfileChanged }) => {
  const needsIdentity = !isIdentityComplete(profile);
  const total = needsIdentity ? 4 : 3;
  const [step, setStep] = useState<'amount' | 'when' | 'identity' | 'sign' | 'done'>('amount');
  const [value, setValue] = useState('0');
  const amount = parseFloat(value.replace(',', '.')) || 0;
  const today = toISODate(new Date());
  const [parts, setParts] = useState<1 | 2 | 3>(1);
  const [due, setDue] = useState(nextFriday());
  const [note, setNote] = useState('');
  const [receive, setReceive] = useState<ReceiveInfo>(profile?.receive || { method: 'paypal', value: profile?.paymentLink || '' });
  const [identity, setIdentity] = useState<BorrowerIdentity>(identityOf(profile, user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schedule = useMemo(() => amount > 0 && due
    ? buildSchedule(parts === 1
      ? { amount, annualRate: 0, loanDate: today, repaymentType: 'in_fine', repaymentDate: due }
      : { amount, annualRate: 0, loanDate: today, repaymentType: 'monthly', installments: parts, firstDueDate: due })
    : [], [amount, parts, due, today]);

  const press = (k: string) => {
    if (k === '⌫') { setValue(v => v.slice(0, -1) || '0'); return; }
    setValue(v => {
      const cur = v === '0' && k !== ',' ? '' : v;
      if (k === ',' && cur.includes(',')) return v;
      if (cur.includes(',') && cur.split(',')[1].length >= 2) return v;
      if (cur.replace(',', '').length >= 6) return v;
      return (cur + k).replace(/^,/, '0,');
    });
  };
  const display = (() => { const [e, d] = value.split(','); const g = e.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return d !== undefined ? `${g},${d}` : g; })();

  if (step === 'amount') return (
    <Screen>
      <TopBar onBack={onBack} progress={[1, total]} />
      <H1>Combien veux-tu demander à {lenderFirstName} ?</H1>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
        <Amount size={64} color={amount ? C.ink : '#9A9CA8'}>{display} €</Amount>
        <div className="flex gap-2">
          {[20, 50, 100, 150].map(v => (
            <button key={v} onClick={() => setValue(String(v))} className="px-3.5 py-2 rounded-full text-sm font-semibold" style={{ background: C.card }}>{euro(v)}</button>
          ))}
        </div>
      </div>
      <div className="px-6 grid grid-cols-3 gap-1">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map(k => (
          <button key={k} onClick={() => press(k)} aria-label={k === '⌫' ? 'Effacer' : k} className="h-[60px] rounded-[14px] text-[26px] font-medium active:bg-black/5">{k}</button>
        ))}
      </div>
      <Footer><Button disabled={amount <= 0} onClick={() => setStep('when')}>Continuer</Button></Footer>
    </Screen>
  );

  if (step === 'when') {
    const quick = [
      { id: nextFriday(), label: 'Vendredi prochain' },
      { id: endOfMonth(), label: 'Fin du mois' },
      { id: addMonths(today, 1), label: 'Dans un mois' },
    ];
    const validDue = due > today;
    return (
      <Screen>
        <TopBar onBack={() => setStep('amount')} progress={[2, total]} />
        <H1 sub={`${euro2(amount)} demandés à ${lenderFirstName}`} desc="C'est toi qui proposes comment tu rembourses.">Quand rembourses-tu ?</H1>
        <div className="px-6 pt-5 flex flex-col gap-4">
          <Chips options={[{ id: '1', label: 'En une fois' }, { id: '2', label: 'En 2 fois' }, { id: '3', label: 'En 3 fois' }]} value={String(parts)} onChange={v => setParts(Number(v) as 1 | 2 | 3)} />
          <div className="flex gap-2 flex-wrap">
            {quick.map(q => (
              <button key={q.label} onClick={() => setDue(q.id)} className="px-3.5 py-2 rounded-full text-sm font-semibold border-[1.5px]"
                style={{ background: due === q.id ? C.ink : '#fff', color: due === q.id ? '#fff' : C.ink, borderColor: due === q.id ? C.ink : C.border }}>{q.label}</button>
            ))}
          </div>
          <Field label={parts === 1 ? 'Date de remboursement' : 'Date du premier versement'} htmlFor="due">
            <input id="due" type="date" min={addMonths(today, 0)} value={due} onChange={e => setDue(e.target.value)} className={inputClass} style={inputStyle} />
          </Field>
          {schedule.length > 0 && validDue && (
            <Card className="px-4 py-3">
              {schedule.map((i, idx) => (
                <div key={i.index} className="flex justify-between text-[15px] py-1.5" style={{ borderTop: idx ? `1px solid ${C.line}` : undefined }}>
                  <span>{dateFr(i.dueDate, { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                  <span className="font-semibold tabular-nums">{euro2(i.amount)}</span>
                </div>
              ))}
            </Card>
          )}
          <ReceiveFields value={receive} onChange={setReceive} defaultHolder={profile?.fullName || user.name} />
          <Field label={`Un mot pour ${lenderFirstName} (facultatif)`} htmlFor="note">
            <textarea id="note" rows={2} maxLength={280} value={note} onChange={e => setNote(e.target.value)} className="w-full rounded-[14px] bg-white px-4 py-3 text-base outline-none border-[1.5px] focus:border-[#1C2551] resize-none" style={inputStyle} placeholder="Pour quoi, par exemple" />
          </Field>
          <Note>Sans intérêt. Si tu dépasses la date, des intérêts de retard au taux légal ({LEGAL_INTEREST_RATE.toLocaleString('fr-FR')} % par an) s'ajoutent, et tu recevras un rappel.</Note>
        </div>
        <Footer><Button disabled={!validDue || !receiveValid(receive)} onClick={() => setStep(needsIdentity ? 'identity' : 'sign')}>Continuer</Button></Footer>
      </Screen>
    );
  }

  if (step === 'identity') return (
    <IdentityStep user={user} profile={profile} progress={[3, total]} onBack={() => setStep('when')}
      onDone={b => { setIdentity(b); onProfileChanged(); setStep('sign'); }} />
  );

  if (step === 'sign') return (
    <SignStep amount={amount} currency="EUR" progress={[total, total]}
      title="Signe ta demande" sub={`Si ${lenderFirstName} accepte, ta signature vaut contrat : ${scheduleSummary(schedule, 'EUR').toLowerCase()}, ${schedule.length > 1 ? `à partir du ${dateFr(due)}` : `le ${dateFr(due)}`}.`}
      cta={`Envoyer à ${lenderFirstName}`} busy={busy} error={error} onBack={() => setStep(needsIdentity ? 'identity' : 'when')}
      onSign={async (words, sig) => {
        setBusy(true); setError(null);
        try {
          const terms: Terms = { amount, currency: 'EUR', loanDate: today, schedule, interestRate: 0, lateRateMode: 'legal', lateInterestRate: 0 };
          await createRequest({ user, lenderUid, lenderName: lenderFirstName, identity, terms, note, amountWords: words, signature: sig, receive: { ...receive, value: receive.value.trim(), holder: receive.method === 'virement' ? (receive.holder ?? (profile?.fullName || user.name)).trim() : undefined } });
          mergeProfile(user.id, { receive: { ...receive, value: receive.value.trim() } }).catch(() => undefined);
          mergeProfile(user.id, { signature: sig }).catch(() => undefined);
          setStep('done');
        } catch (e) { console.error(e); setError("La demande n'a pas pu être envoyée. Réessaie."); }
        finally { setBusy(false); }
      }} />
  );

  const wa = `https://wa.me/?text=${encodeURIComponent(`Je t'ai envoyé ma demande de ${euro2(amount)} sur CKMoney : ${window.location.origin}`)}`;
  return (
    <Done title="Demande envoyée" sub={<>{lenderFirstName} la reçoit dans son appli. Tu seras prévenu dès qu'il répond.</>}>
      <a href={wa} target="_blank" rel="noopener noreferrer" className="h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white" style={{ background: '#1F7A55' }}>
        <Icon name="chat" /> Le prévenir sur WhatsApp
      </a>
      <Button variant="secondary" onClick={onDone}>Voir mon espace</Button>
    </Done>
  );
};

// ---------------------------------------------------------------------------
// Espace de l'ami : ce qu'il doit, à qui, et quand
// ---------------------------------------------------------------------------

export const BorrowerSpace: React.FC<{
  user: User; profile: Profile | null; loans: Loan[]; loading: boolean;
  onOpenLoan: (l: Loan) => void; onRequest: (lenderUid: string, lenderFirstName: string) => void;
  onEditIdentity: () => void; onLogout: () => void; onLegal: (v: 'cgu' | 'privacy') => void; onBack?: () => void;
}> = (p) => {
  const mine = p.loans.filter(l => l.borrowerUid === p.user.id);
  const open = mine.filter(l => ['active', 'delay_requested', 'pending_borrower', 'requested'].includes(l.status));
  const closed = mine.filter(l => !open.includes(l));
  const [cards, setCards] = useState<Record<string, LenderCard | null>>({});
  const [menu, setMenu] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const lenders = Array.from(new Set(mine.map(l => l.lenderUid).filter(Boolean))) as string[];

  useEffect(() => { lenders.forEach(uid => { if (!(uid in cards)) getLenderCard(uid).then(c => setCards(prev => ({ ...prev, [uid]: c }))); }); }, [lenders.join()]);
  useEffect(() => { getUserNotifications(p.user.id).then(n => setNotifs(n.filter(x => !x.read).slice(0, 3))); }, [p.user.id, p.loans]);

  const owed = open.filter(l => l.status === 'active' || l.status === 'delay_requested').reduce((a, l) => a + computeSituation(l, LEGAL_INTEREST_RATE).totalDueNow, 0);
  const lenderName = (l: Loan) => cards[l.lenderUid || '']?.firstName || firstName(l.lenderName);

  const row = (l: Loan, i: number) => {
    const s = computeSituation(l, LEGAL_INTEREST_RATE);
    let sub: string, color = C.mute, amt = s.totalDueNow;
    if (l.status === 'requested') { sub = 'Demande envoyée, en attente'; amt = l.amount; }
    else if (l.status === 'declined') { sub = 'Demande non retenue'; amt = l.amount; }
    else if (l.status === 'pending_borrower') { sub = 'À signer'; color = C.ochreText; amt = l.amount; }
    else if (l.status === 'paid' || s.isFullyPaid) { sub = 'Remboursé'; color = C.green; amt = l.amount; }
    else if (s.isOverdue) { sub = `En retard de ${s.daysLate} j${s.lateInterest > 0 ? ` · +${euro2(s.lateInterest, l.currency)} d'intérêts` : ''}`; color = C.red; }
    else if (l.status === 'delay_requested') { sub = 'Délai demandé'; color = C.ochreText; }
    else sub = s.nextInstallment ? `${euro2(s.nextInstallment.outstanding, l.currency)} ${relDays(s.nextInstallment.dueDate)}` : '';
    return (
      <button key={l.id} onClick={() => p.onOpenLoan(l)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
        <Avatar name={lenderName(l)} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold truncate">{lenderName(l)}</div>
          <div className="text-[13px] font-medium" style={{ color }}>{sub}</div>
        </div>
        <div className="text-[15px] font-bold tabular-nums">{euro2(amt, l.currency)}</div>
      </button>
    );
  };

  // Prochain paiement à faire, avec lien direct
  const nextDue = open.filter(l => l.status === 'active' || l.status === 'delay_requested')
    .map(l => ({ l, s: computeSituation(l, LEGAL_INTEREST_RATE) }))
    .filter(x => x.s.nextInstallment || x.s.isOverdue)
    .sort((a, b) => (a.s.isOverdue ? -1 : 0) - (b.s.isOverdue ? -1 : 0) || (a.s.nextInstallment?.dueDate || '').localeCompare(b.s.nextInstallment?.dueDate || ''))[0];
  const nextAmount = nextDue ? Math.round((nextDue.s.isOverdue ? nextDue.s.overdueAmount + nextDue.s.lateInterest : nextDue.s.nextInstallment!.outstanding + nextDue.s.lateInterest) * 100) / 100 : 0;
  const nextLink = nextDue ? payUrl(cards[nextDue.l.lenderUid || '']?.paymentLink || nextDue.l.lenderPaymentLink, nextAmount, nextDue.l.currency) : null;

  return (
    <Screen>
      <div className="px-5 pt-[max(env(safe-area-inset-top),20px)] flex items-center justify-between">
        {p.onBack ? <button onClick={p.onBack} aria-label="Retour" className="w-10 h-10 -ml-2 flex items-center justify-center"><Icon name="back" /></button> : <CKLogo size="sm" />}
        <button onClick={() => setMenu(true)} aria-label="Mon compte"><Avatar name={p.profile?.fullName || p.user.name} size={36} /></button>
      </div>
      <div className="px-5 pt-7">
        <div className="text-sm" style={{ color: C.mute }}>Tu dois</div>
        {p.loading ? <Skeleton h={58} className="w-48 mt-1" /> : <Amount>{euro2(owed)}</Amount>}
      </div>

      {nextDue && (
        <div className="px-5 pt-5">
          <Card className="p-4">
            <div className="text-[15px] font-semibold" style={{ color: nextDue.s.isOverdue ? C.red : C.ink }}>
              {nextDue.s.isOverdue ? `En retard de ${nextDue.s.daysLate} jour${nextDue.s.daysLate > 1 ? 's' : ''}` : `Prochain paiement ${relDays(nextDue.s.nextInstallment!.dueDate)}`}
            </div>
            <div className="text-sm mt-1" style={{ color: C.text2 }}>
              {euro2(nextAmount, nextDue.l.currency)} à {lenderName(nextDue.l)}
              {nextDue.s.isOverdue && nextDue.s.lateInterest > 0 ? `, dont ${euro2(nextDue.s.lateInterest, nextDue.l.currency)} d'intérêts de retard` : ''}
              {!nextDue.s.isOverdue && nextDue.s.nextInstallment ? `, le ${dateFr(nextDue.s.nextInstallment.dueDate, { day: 'numeric', month: 'long' })}` : ''}.
            </div>
            <div className={`grid ${nextLink ? "grid-cols-2" : "grid-cols-1"} gap-2 mt-3`}>
              {nextLink
                ? <a href={nextLink} target="_blank" rel="noopener noreferrer" className="h-12 rounded-[14px] flex items-center justify-center text-[15px] font-bold text-white" style={{ background: C.ink }}>Payer</a>
                : null}
              <button onClick={() => p.onOpenLoan(nextDue.l)} className="h-12 rounded-[14px] text-[15px] font-bold" style={{ background: C.soft, color: C.ink }}>J'ai payé</button>
            </div>
          </Card>
        </div>
      )}

      <div className="px-5 pt-4"><PushCard uid={p.user.id} text="On te rappelle la veille de chaque échéance, et tu sais tout de suite quand ta demande est acceptée." /></div>
      {notifs.length > 0 && (
        <div className="px-5 pt-4 flex flex-col gap-2">
          {notifs.map(n => (
            <button key={n.id} onClick={() => { markNotificationAsRead(n.id); setNotifs(x => x.filter(y => y.id !== n.id)); const l = p.loans.find(x => x.id === n.loanId); if (l) p.onOpenLoan(l); }}
              className="text-left rounded-2xl px-4 py-3 flex gap-3" style={{ background: C.ochreSoft }}>
              <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: C.ochre }} />
              <span><span className="text-[14px] font-semibold block">{n.title}</span><span className="text-[13px]" style={{ color: C.text2 }}>{n.message}</span></span>
            </button>
          ))}
        </div>
      )}

      <div className="px-5 pt-7 pb-3 text-[17px] font-bold">En cours</div>
      <div className="px-5">
        {p.loading ? <div className="flex flex-col gap-2"><Skeleton /><Skeleton /></div>
          : open.length ? <Card>{open.map(row)}</Card>
          : <div className="text-sm" style={{ color: C.mute }}>Rien en cours. Tu ne dois rien à personne.</div>}
      </div>

      {lenders.length > 0 && (
        <div className="px-5 pt-5 flex flex-col gap-2.5">
          {lenders.map(uid => {
            const name = cards[uid]?.firstName || firstName(mine.find(l => l.lenderUid === uid)?.lenderName || '');
            return <Button key={uid} variant="secondary" onClick={() => p.onRequest(uid, name)}><Icon name="plus" size={20} /> Demander à {name}</Button>;
          })}
        </div>
      )}

      {closed.length > 0 && (
        <>
          <div className="px-5 pt-7 pb-3 text-[17px] font-bold">Terminés</div>
          <div className="px-5"><Card>{closed.map(row)}</Card></div>
        </>
      )}
      <div className="h-10" />

      <Sheet open={menu} onClose={() => setMenu(false)} title={p.profile?.fullName || p.user.name}>
        <div className="flex flex-col gap-2.5">
          <div className="text-sm -mt-2 mb-1" style={{ color: C.mute }}>{p.user.email}</div>
          <Button variant="secondary" onClick={() => { setMenu(false); p.onEditIdentity(); }}>Mes informations</Button>
          <Button variant="secondary" onClick={() => { setMenu(false); p.onLegal('cgu'); }}>Conditions d'utilisation</Button>
          <Button variant="secondary" onClick={() => { setMenu(false); p.onLegal('privacy'); }}>Confidentialité</Button>
          <Button variant="danger" onClick={p.onLogout}>Se déconnecter</Button>
        </div>
      </Sheet>
    </Screen>
  );
};

/** Modifier son identité depuis l'espace ami (même écran que la première fois). */
export const IdentityEditor: React.FC<{ user: User; profile: Profile | null; onClose: () => void; onSaved: () => void }> = ({ user, profile, onClose, onSaved }) => (
  <IdentityStep user={user} profile={profile} progress={[1, 1]} onBack={onClose} onDone={() => { onSaved(); onClose(); }} />
);

