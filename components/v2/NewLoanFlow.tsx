import React, { useEffect, useMemo, useState } from 'react';
import { Loan, Profile, User } from '../../types';
import {
  Screen, TopBar, H1, Amount, Button, Card, Chips, Field, inputClass, inputStyle, Note, Footer, Sheet, Avatar,
  SlideToConfirm, Icon, C, euro, euro2, dateFr,
} from './ui';
import SignaturePad from '../SignaturePad';
import { buildSchedule, addMonths, toISODate } from '../../utils/schedule';
import { createOffer, updateOffer, inviteLinkFor, knownFriends, KnownFriend, Terms } from '../../services/loanService';
import { annualTotalsForBorrower, loansInLast12Months } from '../../utils/compliance';
import { fetchExchangeRate } from '../../services/exchangeRate';
import {
  rateCapFor, RATE_CAP_LABEL, LEGAL_INTEREST_RATE, DECLARATION_THRESHOLD_EUR, HABITUAL_LENDING_WARNING_COUNT, MAX_INSTALLMENTS,
  PENALTY_MAX,
} from '../../config/legal';

const PREFIXES = [
  { code: '33', label: '+33' }, { code: '237', label: '+237' }, { code: '32', label: '+32' }, { code: '41', label: '+41' },
  { code: '1', label: '+1' }, { code: '225', label: '+225' }, { code: '221', label: '+221' }, { code: '44', label: '+44' },
];
const CURRENCIES = ['EUR', 'XAF', 'USD', 'CHF', 'GBP', 'CAD'];

/** Normalise un numéro saisi ou issu des contacts en format international sans « + » (pour wa.me). */
const normalizePhone = (raw: string, prefix: string) => {
  let d = (raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return prefix + d;
};

const contactsSupported = () => typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

interface Props {
  user: User;
  profile: Profile;
  loans: Loan[];
  prefill?: { friend?: KnownFriend; amount?: number; schedule?: string; dueDate?: string; counterOf?: string };
  /** Offre non signée à modifier : le lien déjà envoyé reste le même. */
  editLoan?: Loan;
  onClose: () => void;
  onDone: (loanId: string) => void;
}

const NewLoanFlow: React.FC<Props> = ({ user, profile, loans, prefill: prefillIn, editLoan, onClose, onDone }) => {
  const prefill = editLoan
    ? { amount: editLoan.amount, friend: { uid: editLoan.borrowerUid, nickname: editLoan.borrowerNickname || editLoan.borrowerName, phone: editLoan.borrowerPhone, lastLoan: editLoan } as KnownFriend,
        dueDate: (editLoan.schedule || []).length === 1 ? editLoan.schedule![0].dueDate : undefined, counterOf: undefined as string | undefined }
    : prefillIn;
  const [step, setStep] = useState(prefill?.amount ? 3 : 1);
  // Étape 1 : montant
  const [value, setValue] = useState(prefill?.amount ? String(prefill.amount).replace('.', ',') : '0');
  const amount = parseFloat(value.replace(',', '.')) || 0;
  // Étape 2 : à qui
  const friends = useMemo(() => knownFriends(loans, user.id), [loans, user.id]);
  const [friend, setFriend] = useState<KnownFriend | null>(prefill?.friend || null);
  const [nickname, setNickname] = useState(prefill?.friend?.nickname || '');
  const [prefix, setPrefix] = useState('33');
  const [phone, setPhone] = useState('');
  // Étape 3 : remboursement
  const today = toISODate(new Date());
  // En modification, on reprend l'échéancier tel quel, même si une date est déjà passée.
  const editSchedule = editLoan?.schedule || [];
  const [plan, setPlan] = useState<'once' | 'm3' | 'm6' | 'custom'>(
    editLoan ? (editSchedule.length > 1 ? 'custom' : 'once') : prefill?.dueDate ? 'once' : 'm3');
  const [onceDate, setOnceDate] = useState(
    editLoan && editSchedule.length === 1 ? editSchedule[0].dueDate
      : prefill?.dueDate && prefill.dueDate > today ? prefill.dueDate : addMonths(today, 3));
  const [customMonths, setCustomMonths] = useState(editSchedule.length > 1 ? editSchedule.length : 4);
  const [firstDue, setFirstDue] = useState(editSchedule.length > 1 ? editSchedule[0].dueDate : addMonths(today, 1));
  const [loanDate, setLoanDate] = useState(editLoan?.loanDate || today);
  const alreadyGiven = loanDate < today;
  const [currency, setCurrency] = useState(editLoan?.currency || 'EUR');
  const [rate, setRate] = useState(editLoan?.interestRate || 0);
  const [lateMode, setLateMode] = useState<'legal' | 'none' | 'custom'>(editLoan?.lateRateMode || 'legal');
  const [lateRate, setLateRate] = useState(editLoan?.lateRateMode === 'custom' ? (editLoan.lateInterestRate || 3) : 3);
  const [penaltyRate, setPenaltyRate] = useState<number>(editLoan ? (editLoan.penaltyRate || 0) : (profile.penaltyRate || 0));
  const [delayRate, setDelayRate] = useState<number>(editLoan ? (editLoan.delayRate || 0) : (profile.delayRate || 0));
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [drawnSig, setDrawnSig] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Étape 4 : envoi
  const [result, setResult] = useState<{ loanId: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const schedule = useMemo(() => {
    if (amount <= 0) return [];
    const base = { amount, annualRate: rate, loanDate };
    if (plan === 'once') return buildSchedule({ ...base, repaymentType: 'in_fine', repaymentDate: onceDate });
    const n = plan === 'm3' ? 3 : plan === 'm6' ? 6 : Math.max(2, Math.min(MAX_INSTALLMENTS, customMonths));
    return buildSchedule({ ...base, repaymentType: 'monthly', installments: n, firstDueDate: firstDue });
  }, [amount, rate, loanDate, plan, onceDate, customMonths, firstDue]);

  const friendLabel = friend ? friend.nickname : nickname.trim();
  const fullPhone = friend?.phone || (phone.trim() ? normalizePhone(phone, prefix) : '');

  // Garde-fous : cumul annuel (2062) et caractère habituel
  const [cumulative, setCumulative] = useState(0);
  useEffect(() => {
    let alive = true;
    const key = (friend?.uid || friend?.phone || fullPhone || friendLabel).toLowerCase();
    Promise.all([
      annualTotalsForBorrower(loans.filter(l => l.lenderUid === user.id), key, parseInt(loanDate.slice(0, 4), 10)),
      fetchExchangeRate(amount, currency),
    ]).then(([prev, cur]) => { if (alive) setCumulative(prev + cur); });
    return () => { alive = false; };
  }, [friend, fullPhone, friendLabel, loanDate, amount, currency, loans, user.id]);
  const recent = loansInLast12Months(loans, user.id);

  // Clavier
  const press = (k: string) => {
    if (k === '⌫') { setValue(v => v.slice(0, -1) || '0'); return; }
    setValue(v => {
      let cur = v === '0' && k !== ',' ? '' : v;
      if (k === ',' && cur.includes(',')) return v;
      if (cur.includes(',') && cur.split(',')[1].length >= 2) return v;
      if (cur.replace(',', '').length >= 7) return v;
      return (cur + k).replace(/^,/, '0,');
    });
  };
  const display = (() => {
    const [e, d] = value.split(',');
    const g = e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return d !== undefined ? `${g},${d}` : g;
  })();

  const pickContact = async () => {
    try {
      const res = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false });
      const c = res?.[0];
      if (!c) return;
      setFriend(null);
      setNickname((c.name?.[0] || '').split(' ')[0] || c.name?.[0] || '');
      const tel: string = c.tel?.[0] || '';
      if (tel.startsWith('+') || tel.startsWith('00')) { setPhone(tel); } else setPhone(tel);
    } catch { /* annulé */ }
  };

  const cap = rateCapFor(amount, currency);
  useEffect(() => { if (rate > cap) setRate(cap); if (lateRate > cap) setLateRate(cap); }, [cap]);
  const totalInterest = schedule.reduce((a, i) => a + i.interest, 0);

  const signature = profile.signature || drawnSig;
  const canSign = amount > 0 && !!friendLabel && schedule.length > 0 && !!signature && rate <= cap && (alreadyGiven ? schedule.every(i => i.dueDate >= loanDate) : schedule.every(i => i.dueDate >= today)) && (lateMode !== 'custom' || (lateRate > 0 && lateRate <= cap));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const terms: Terms = { amount, currency, loanDate, schedule, interestRate: rate, lateRateMode: lateMode, lateInterestRate: lateRate, penaltyRate, delayRate: Math.min(cap, delayRate) };
      if (editLoan) {
        await updateOffer(editLoan, { user, profile, terms, nickname: friendLabel, phone: fullPhone || undefined, lenderSignature: signature });
        setResult({ loanId: editLoan.id, token: editLoan.inviteToken || '' });
        setStep(4);
        return;
      }
      const r = await createOffer({
        user, profile, terms, nickname: friendLabel, phone: fullPhone || undefined,
        lenderSignature: signature, knownBorrowerUid: friend?.uid, counterOf: prefill?.counterOf, borrowerPaymentLink: friend?.lastLoan?.borrowerPaymentLink, borrowerReceive: friend?.lastLoan?.borrowerReceive,
      });
      setResult(r);
      setStep(4);
    } catch (e) {
      console.error(e);
      setError("Le contrat n'a pas pu être créé. Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(false);
    }
  };

  // ---------- Étape 1 : montant
  if (step === 1) return (
    <Screen>
      <TopBar onBack={onClose} progress={[1, 3]} />
      <H1>Combien prêtes-tu ?</H1>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
        <Amount size={64} color={amount ? C.ink : '#9A9CA8'}>{display} {currency === 'EUR' ? '€' : currency}</Amount>
        <div className="flex gap-2">
          {[100, 500, 1000].map(v => (
            <button key={v} onClick={() => setValue(String(v))} className="px-3.5 py-2 rounded-full text-sm font-semibold" style={{ background: C.card }}>{euro(v)}</button>
          ))}
        </div>
      </div>
      <div className="px-6 grid grid-cols-3 gap-1">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map(k => (
          <button key={k} onClick={() => press(k)} aria-label={k === '⌫' ? 'Effacer' : k} className="h-[60px] rounded-[14px] text-[26px] font-medium active:bg-black/5">{k}</button>
        ))}
      </div>
      <Footer><Button disabled={amount <= 0} onClick={() => setStep(2)}>Continuer</Button></Footer>
    </Screen>
  );

  // ---------- Étape 2 : à qui
  if (step === 2) return (
    <Screen>
      <TopBar onBack={() => setStep(1)} progress={[2, 3]} />
      <H1 sub={`${euro(amount, currency)} pour`}>À qui prêtes-tu ?</H1>
      {contactsSupported() && (
        <div className="px-6 pt-5">
          <button onClick={pickContact} className="w-full h-14 rounded-2xl px-4 flex items-center gap-3 text-base font-semibold text-left" style={{ background: C.card }}>
            <Icon name="search" /><span className="flex-1">Choisir dans mes contacts</span><Icon name="chevron" size={18} />
          </button>
        </div>
      )}
      {friends.length > 0 && (
        <div className="px-6 pt-6">
          <div className="text-[13px] font-semibold mb-3" style={{ color: C.mute }}>Récents</div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {friends.slice(0, 8).map(f => (
              <button key={f.uid || f.phone || f.nickname} onClick={() => { setFriend(f); setStep(3); }} className="flex flex-col items-center gap-1.5 text-[13px] font-semibold shrink-0">
                <Avatar name={f.nickname} size={56} />{f.nickname}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mx-6 mt-6 h-px" style={{ background: C.border }} />
      <div className="px-6 pt-5 flex flex-col gap-3.5">
        <div className="text-[17px] font-bold">{friends.length || contactsSupported() ? 'Pas dans tes contacts ?' : 'Ton proche'}</div>
        <Field label="Prénom ou surnom" htmlFor="nick">
          <input id="nick" value={nickname} onChange={e => { setNickname(e.target.value); setFriend(null); }} className={inputClass} style={inputStyle} autoComplete="off" />
        </Field>
        <Field label="Numéro WhatsApp" htmlFor="tel" hint="Facultatif : pour lui envoyer le lien en un geste.">
          <div className="flex gap-2">
            <select aria-label="Indicatif" value={prefix} onChange={e => setPrefix(e.target.value)} className="h-[52px] rounded-[14px] bg-white px-3 border-[1.5px] font-semibold" style={inputStyle}>
              {PREFIXES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
            <input id="tel" type="tel" inputMode="tel" value={phone} onChange={e => { setPhone(e.target.value); setFriend(null); }} placeholder="6 12 34 56 78" className={inputClass} style={inputStyle} />
          </div>
        </Field>
        <Note>C'est tout ce qu'il te faut. Ton proche complètera lui-même son nom, sa date de naissance et son adresse au moment de signer.</Note>
      </div>
      <Footer><Button disabled={!nickname.trim()} onClick={() => setStep(3)}>Continuer</Button></Footer>
    </Screen>
  );

  // ---------- Étape 3 : remboursement et signature
  if (step === 3) {
    const last = schedule[schedule.length - 1];
    const lateLabel = lateMode === 'legal' ? 'taux légal si retard' : lateMode === 'none' ? 'pas de pénalité' : `${lateRate.toLocaleString('fr-FR')} % si retard`;
    return (
      <Screen>
        <TopBar onBack={() => setStep(prefill?.amount ? 1 : 2)} progress={[3, 3]} />
        <H1 sub={`${euro(amount, currency)} pour ${friendLabel}`}>Comment veux-tu être remboursé ?</H1>
        <div className="px-6 pt-5">
          <Chips value={plan} onChange={v => setPlan(v as any)} options={[{ id: 'once', label: 'En une fois' }, { id: 'm3', label: '3 mois' }, { id: 'm6', label: '6 mois' }, { id: 'custom', label: 'Sur mesure' }]} />
        </div>
        <div className="px-6 pt-4">
          <Card className="p-4 flex flex-col gap-3">
            <div className="text-sm font-semibold">L'argent</div>
            <Chips value={alreadyGiven ? 'before' : 'now'} onChange={v => setLoanDate(v === 'now' ? today : (alreadyGiven ? loanDate : addMonths(today, -1)))}
              options={[{ id: 'now', label: 'Je le donne maintenant' }, { id: 'before', label: 'Déjà donné' }]} />
            {alreadyGiven && (
              <>
                <label className="flex justify-between items-center text-sm gap-3">
                  <span style={{ color: C.mute }}>Donné le</span>
                  <input type="date" value={loanDate} max={today} onChange={e => setLoanDate(e.target.value || today)} className="font-semibold bg-transparent text-right" />
                </label>
                {schedule.some(i => i.dueDate < today) && <Note tone="warn">Une échéance est déjà passée : {friendLabel} sera en retard dès sa signature, avec les intérêts de retard prévus depuis cette date.</Note>}
                <div className="text-[13px] leading-snug" style={{ color: C.mute }}>Indique ce qu'il te doit encore. Le contrat met au propre ce prêt déjà versé, avec un échéancier pour la suite.</div>
              </>
            )}
          </Card>
        </div>
        <div className="px-6 pt-3">
          <Card className="p-4 flex flex-col gap-3.5">
            {schedule.length > 0 && (
              <div className="flex justify-between items-baseline">
                <div className="text-sm" style={{ color: C.mute }}>{schedule.length > 1 ? `${schedule.length} mensualités de` : 'À rembourser'}</div>
                <Amount size={26}>{euro2(schedule[0].amount, currency)}</Amount>
              </div>
            )}
            {plan === 'once' ? (
              <label className="flex justify-between items-center text-sm gap-3">
                <span style={{ color: C.mute }}>Au plus tard le</span>
                <input type="date" value={onceDate} min={alreadyGiven ? loanDate : today} onChange={e => setOnceDate(e.target.value)} className="font-semibold bg-transparent text-right" />
              </label>
            ) : (
              <>
                {plan === 'custom' && (
                  <label className="flex justify-between items-center text-sm gap-3">
                    <span style={{ color: C.mute }}>Nombre de mois</span>
                    <input type="number" min={2} max={MAX_INSTALLMENTS} value={customMonths} onChange={e => setCustomMonths(parseInt(e.target.value, 10) || 2)} className="w-16 font-semibold bg-transparent text-right" />
                  </label>
                )}
                <label className="flex justify-between items-center text-sm gap-3">
                  <span style={{ color: C.mute }}>Première échéance</span>
                  <input type="date" value={firstDue} min={alreadyGiven ? loanDate : today} onChange={e => setFirstDue(e.target.value)} className="font-semibold bg-transparent text-right" />
                </label>
                {last && <div className="flex justify-between text-sm"><span style={{ color: C.mute }}>Dernière</span><span className="font-semibold">{dateFr(last.dueDate)}</span></div>}
              </>
            )}
            <div className="h-px" style={{ background: C.line }} />
            <button onClick={() => setOptionsOpen(true)} className="flex items-center gap-3 text-left">
              <div className="flex-1">
                <div className="text-[15px] font-semibold">Options</div>
                <div className="text-[13px]" style={{ color: C.mute }}>{rate ? `${rate.toLocaleString('fr-FR')} % d'intérêt` : 'Sans intérêt'} · {lateLabel}{penaltyRate ? ` · pénalité ${penaltyRate.toLocaleString('fr-FR')} %` : ''}{delayRate ? ` · report ${Math.min(cap, delayRate).toLocaleString('fr-FR')} %` : ''}</div>
              </div>
              <Icon name="chevron" size={18} />
            </button>
          </Card>
        </div>

        <div className="px-6 pt-4 flex flex-col gap-2.5">
          {cumulative > DECLARATION_THRESHOLD_EUR && (
            <Note tone="warn" icon="file">Au total, environ {Math.round(cumulative).toLocaleString('fr-FR')} € prêtés à {friendLabel} cette année : le prêt devra être déclaré (formulaire 2062) au printemps prochain.</Note>
          )}
          {recent >= HABITUAL_LENDING_WARNING_COUNT && (
            <Note tone="danger" icon="alert">Déjà {recent} prêts en 12 mois : prêter de façon répétée peut être assimilé à une activité de crédit, réservée aux banques.</Note>
          )}
          {!profile.signature && (
            <div>
              <div className="text-[13px] font-semibold mb-1.5" style={{ color: C.text2 }}>Ta signature</div>
              <SignaturePad label="Signe dans le cadre" onSave={setDrawnSig} />
            </div>
          )}
          <p className="text-[13px] leading-[1.5]" style={{ color: C.mute }}>
            En signant, j'atteste {alreadyGiven ? 'avoir prêté' : 'prêter'} mes propres fonds à titre personnel et occasionnel. {friendLabel} relira le contrat avant de signer à son tour.
          </p>
          {error && <Note tone="danger" icon="alert">{error}</Note>}
        </div>
        <Footer><SlideToConfirm label="Glisser pour signer" onConfirm={submit} disabled={!canSign} busy={busy} /></Footer>

        <Sheet open={optionsOpen} onClose={() => setOptionsOpen(false)} title="Options du prêt">
          <div className="flex flex-col gap-5">
            <Field label={`Intérêts : ${rate ? `${rate.toLocaleString('fr-FR')} % par an` : 'aucun'}`} hint={`${rate ? `Soit ${euro2(totalInterest, currency)} d'intérêts au total. ` : ''}Maximum légal pour ce montant : ${cap.toLocaleString('fr-FR')} % par an (${RATE_CAP_LABEL}). Les intérêts reçus sont imposables pour toi.`}>
              <input type="range" min={0} max={cap} step={0.25} value={rate} onChange={e => setRate(parseFloat(e.target.value))} className="w-full accent-[#1C2551]" />
            </Field>
            <Field label={`Pénalité forfaitaire si retard : ${penaltyRate ? `${penaltyRate.toLocaleString('fr-FR')} %` : 'aucune'}`}
              hint={`Due une fois par échéance non payée à temps${penaltyRate ? `, soit ${euro2(amount * penaltyRate / 100, currency)} sur ce prêt` : ''}. Maximum ${PENALTY_MAX} % : au-delà, un juge la réduirait.`}>
              <input type="range" min={0} max={PENALTY_MAX} step={1} value={penaltyRate} onChange={e => setPenaltyRate(parseFloat(e.target.value))} className="w-full accent-[#1C2551]" />
            </Field>
            <button type="button" onClick={() => setAdvanced(v => !v)} aria-expanded={advanced} className="flex items-center justify-between text-left">
              <span>
                <span className="text-[15px] font-semibold block">Réglages avancés</span>
                <span className="text-[13px]" style={{ color: C.mute }}>{lateLabel}{delayRate ? ` · report ${Math.min(cap, delayRate).toLocaleString('fr-FR')} %` : ''} · {currency}</span>
              </span>
              <span style={{ transform: advanced ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }}><Icon name="chevron" size={18} /></span>
            </button>
            {advanced && (<>
            <Field label="En cas de retard">
              <Chips value={lateMode} onChange={v => setLateMode(v as any)} options={[{ id: 'legal', label: 'Taux légal' }, { id: 'none', label: 'Rien' }, { id: 'custom', label: 'Mon taux' }]} />
            </Field>
            {lateMode === 'legal' && <Note>Intérêts au taux légal ({LEGAL_INTEREST_RATE.toLocaleString('fr-FR')} % par an aujourd'hui) sur les sommes en retard. C'est le réglage le plus sûr.</Note>}
            {lateMode === 'custom' && (
              <Field label={`Taux de retard : ${lateRate.toLocaleString('fr-FR')} % par an`} hint="Un juge peut réduire une pénalité excessive.">
                <input type="range" min={0.5} max={cap} step={0.25} value={lateRate} onChange={e => setLateRate(parseFloat(e.target.value))} className="w-full accent-[#1C2551]" />
              </Field>
            )}
            <Field label={`Taux de report : ${delayRate ? `${Math.min(cap, delayRate).toLocaleString('fr-FR')} % par an` : 'taux de retard'}`}
              hint={`Appliqué si ton proche demande une nouvelle date, depuis l'échéance manquée. Maximum ${cap.toLocaleString('fr-FR')} % pour ce montant.`}>
              <input type="range" min={0} max={cap} step={0.5} value={Math.min(cap, delayRate)} onChange={e => setDelayRate(parseFloat(e.target.value))} className="w-full accent-[#1C2551]" />
            </Field>
            <div>
              <Field label="Devise" htmlFor="cur">
                <select id="cur" value={currency} onChange={e => setCurrency(e.target.value)} className={inputClass} style={inputStyle}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            </>)}
            <Button onClick={() => setOptionsOpen(false)}>Valider</Button>
          </div>
        </Sheet>
      </Screen>
    );
  }

  // ---------- Étape 4 : envoi
  const link = result ? inviteLinkFor(result.token) : '';
  const message = prefill?.counterOf
    ? `Salut ${friendLabel}, pour ta demande de ${euro(amount, currency)}, je te propose plutôt : ${schedule.length > 1 ? `${schedule.length} × ${euro2(schedule[0].amount, currency)} à partir du ${dateFr(schedule[0].dueDate)}` : `remboursement le ${dateFr(schedule[0].dueDate)}`}${rate ? `, ${rate.toLocaleString('fr-FR')} % d'intérêts par an` : ', sans intérêt'}. Si ça te va, signe ici : ${link}`
    : alreadyGiven
    ? `Salut ${friendLabel}, comme on en a parlé, je mets au propre les ${euro(amount, currency)} que je t'ai prêtés le ${dateFr(loanDate)} : ${schedule.length > 1 ? `${schedule.length} × ${euro2(schedule[0].amount, currency)} à partir du ${dateFr(schedule[0].dueDate)}` : `${schedule[0].dueDate < toISODate(new Date()) ? 'remboursement prévu le' : 'à rembourser le'} ${dateFr(schedule[0].dueDate)}`}${rate ? '' : ', sans intérêt'}. Tu peux le lire et le signer ici : ${link}`
    : `Salut ${friendLabel}, voici le contrat pour les ${euro(amount, currency)} (${schedule.length > 1 ? `${schedule.length} × ${euro2(schedule[0].amount, currency)}` : `à rembourser le ${dateFr(schedule[0].dueDate)}`}${rate ? '' : ', sans intérêt'}). Tu peux le lire et le signer ici : ${link}`;
  const extras = penaltyRate ? ` En cas de retard : pénalité de ${penaltyRate} % et intérêts de retard.` : '';
  const wa = `https://wa.me/${fullPhone}?text=${encodeURIComponent(editLoan ? `Salut ${friendLabel}, j'ai mis à jour le contrat (${euro(amount, currency)}).${extras} Le lien reste le même : ${link}` : message.replace(/ Tu peux le lire| Si ça te va/, m => `${extras}${m}`))}`;
  return (
    <Screen>
      <TopBar right={<button onClick={() => result && onDone(result.loanId)} aria-label="Fermer" className="w-11 h-11 flex items-center justify-center"><Icon name="close" /></button>} />
      <div className="px-6 pt-2 flex flex-col items-center text-center">
        <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center" style={{ background: C.greenSoft, color: C.green }}><Icon name="check" size={34} /></div>
        <h1 className="text-[26px] font-bold mt-5">{editLoan ? 'Contrat mis à jour' : 'Contrat signé'}</h1>
        <p className="text-[15px] mt-2 leading-[1.5]" style={{ color: C.mute }}>
          {editLoan ? `Le lien déjà envoyé à ${friendLabel} reste le même : il verra les nouvelles conditions en l'ouvrant.`
            : friend?.uid ? `${friendLabel} le voit déjà dans son appli. Tu peux aussi le prévenir sur WhatsApp.` : `Envoie maintenant le lien à ${friendLabel} pour qu'il le signe à son tour.`}
        </p>
      </div>
      <div className="px-6 pt-7 flex flex-col gap-1.5">
        <div className="text-[13px] font-semibold" style={{ color: C.mute }}>Aperçu du message</div>
        <div className="self-end max-w-[300px] px-3.5 py-3 text-sm leading-[1.45] rounded-[14px_14px_4px_14px]" style={{ background: '#DCF8C6', color: '#1B2B1E' }}>
          {message.replace(link, '')}<span className="block mt-1.5 font-semibold break-all" style={{ color: '#0B6E99' }}>{link}</span>
        </div>
      </div>
      {!friend?.uid && (
        <div className="px-6 pt-5"><Note icon="lock">Ce lien est personnel : la première personne qui l'ouvre et signe devient l'emprunteur, puis il ne fonctionne plus pour personne d'autre.</Note></div>
      )}
      <Footer>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="w-full h-14 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 text-white" style={{ background: C.green }}>
          <Icon name="chat" size={20} /> Envoyer sur WhatsApp
        </a>
        <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }}>{copied ? 'Lien copié' : 'Copier le lien'}</Button>
        <Button variant="ghost" onClick={() => result && onDone(result.loanId)}>Voir le prêt</Button>
      </Footer>
    </Screen>
  );
};

export default NewLoanFlow;
