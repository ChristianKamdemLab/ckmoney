import { adminAuth, adminDb } from './admin.js';
import { sendMail } from './mail.js';
import { computeSituation } from '../../utils/schedule.js';
import { LEGAL_INTEREST_RATE, DECLARATION_THRESHOLD_EUR, HABITUAL_LENDING_WARNING_COUNT, ratesOutdated } from '../../config/legal.js';

// Le 1er de chaque mois : bilan au prêteur (encours, retards, intérêts perçus, garde-fous légaux)
// et sauvegarde de ses prêts en pièce jointe JSON. Gratuit : envoyé depuis son Gmail.

const eur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const first = (s?: string) => (s || '').trim().split(/\s+/)[0] || '';

export const runMonthly = async (today: string) => {
  const [y, m] = today.split('-').map(Number);
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const prevMonthLabel = new Date(prevMonth + '-15T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const yearOfReport = m === 1 ? y - 1 : y;
  const lenders = await adminDb.collection('lenders').get();
  let sent = 0;

  for (const l of lenders.docs) {
    const uid = l.id;
    const email = (await adminAuth.getUser(uid).catch(() => null))?.email;
    if (!email) continue;
    const snap = await adminDb.collection('loans').where('lenderUid', '==', uid).get();
    const loans: any[] = [];
    for (const d of snap.docs) {
      const loan: any = { id: d.id, ...d.data() };
      loan.payments = (await d.ref.collection('payments').get()).docs.map(p => ({ id: p.id, ...p.data() }));
      loans.push(loan);
    }
    const profile = (await adminDb.collection('profiles').doc(uid).get()).data() || null;

    const signed = loans.filter(x => ['active', 'delay_requested', 'paid'].includes(x.status));
    const open = signed.filter(x => x.status !== 'paid');
    const rows = open.map(x => {
      const s = computeSituation(x, LEGAL_INTEREST_RATE, new Date(today + 'T12:00:00'));
      return { name: x.borrowerNickname || first(x.borrowerName), currency: x.currency, due: s.totalDueNow, late: s.isOverdue ? s.daysLate : 0, extra: s.lateInterest + s.penalty, fully: s.isFullyPaid };
    }).filter(r => !r.fully);
    const totalOwed = rows.filter(r => r.currency === 'EUR').reduce((a, r) => a + r.due, 0);
    const lateRows = rows.filter(r => r.late > 0);

    // Intérêts conventionnels perçus (estimation au prorata des paiements confirmés) + frais de retard
    let interestMonth = 0, interestYear = 0;
    for (const x of signed) {
      if (x.currency !== 'EUR') continue;
      const s = computeSituation(x, LEGAL_INTEREST_RATE);
      const share = s.totalScheduled > 0 ? s.totalInterest / s.totalScheduled : 0;
      for (const p of x.payments.filter((p: any) => p.status === 'confirmed')) {
        const v = p.amount * share;
        if (p.date.startsWith(prevMonth)) interestMonth += v;
        if (p.date.startsWith(String(yearOfReport))) interestYear += v;
      }
    }

    // Garde-fous : prêts sur 12 mois glissants, cumul annuel par proche (formulaire 2062)
    const yearAgo = new Date(new Date(today).getTime() - 365 * 86400000).toISOString().slice(0, 10);
    const last12 = signed.filter(x => (x.loanDate || '') >= yearAgo).length;
    const byFriend = new Map<string, number>();
    for (const x of signed.filter(x => (x.loanDate || '').startsWith(String(yearOfReport)) && x.currency === 'EUR')) {
      const k = x.borrowerUid || x.borrowerNickname || x.borrowerName;
      byFriend.set(k, (byFriend.get(k) || 0) + x.amount);
    }
    const toDeclare = [...byFriend.entries()].filter(([, v]) => v > DECLARATION_THRESHOLD_EUR)
      .map(([k, v]) => ({ name: (signed.find(x => (x.borrowerUid || x.borrowerNickname || x.borrowerName) === k)?.borrowerNickname) || 'un proche', v }));

    const alerts: string[] = [];
    if (last12 >= HABITUAL_LENDING_WARNING_COUNT) alerts.push(`${last12} prêts sur les 12 derniers mois : reste sur des prêts ponctuels, sans intérêt de préférence (art. L511-5 du Code monétaire et financier).`);
    toDeclare.forEach(t => alerts.push(`${t.name} : ${eur(t.v)} prêtés en ${yearOfReport}, au-delà de ${DECLARATION_THRESHOLD_EUR.toLocaleString('fr-FR')} € : prêt à déclarer (formulaire 2062).`));
    if (ratesOutdated(today)) alerts.push("Les taux légaux de l'appli ne sont plus à jour : valide la mise à jour proposée sur GitHub.");

    const table = rows.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(r => `<tr><td style="padding:8px 0;border-top:1px solid #EFEBE3">${esc(r.name)}${r.late ? ` <span style="color:#B42318">· ${r.late} j de retard</span>` : ''}</td><td style="padding:8px 0;border-top:1px solid #EFEBE3;text-align:right;font-weight:700">${r.currency === 'EUR' ? eur(r.due) : `${r.due.toFixed(2)} ${esc(r.currency)}`}</td></tr>`).join('')}</table>`
      : '<p style="color:#6B6F80">Aucun prêt en cours.</p>';
    const html = `<!doctype html><html><body style="margin:0;background:#F7F6F2;font-family:Figtree,Arial,sans-serif;color:#1C2551">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
  <div style="font-weight:800;font-size:18px">CK<span style="color:#C98A1E">Money</span> · bilan de ${esc(prevMonthLabel)}</div>
  <div style="background:#fff;border-radius:18px;padding:22px;margin-top:16px">
    <div style="color:#6B6F80;font-size:14px">On te doit</div>
    <div style="font-family:Georgia,serif;font-size:34px;font-weight:600">${eur(totalOwed)}</div>
    <div style="color:#6B6F80;font-size:14px;margin-bottom:12px">${rows.length} prêt${rows.length > 1 ? 's' : ''} en cours${lateRows.length ? ` · ${lateRows.length} en retard` : ''}</div>
    ${table}
  </div>
  <div style="background:#fff;border-radius:18px;padding:22px;margin-top:12px;font-size:14px;line-height:1.6">
    <strong>Impôts</strong><br>
    Intérêts perçus en ${esc(prevMonthLabel)} : ${eur(interestMonth)} · depuis janvier ${yearOfReport} : ${eur(interestYear)} (estimation, à déclarer avec tes revenus).<br>
    Prêts signés sur 12 mois : ${last12}.
  </div>
  ${alerts.length ? `<div style="background:#F6EBD6;border-radius:18px;padding:18px 22px;margin-top:12px;font-size:14px;line-height:1.55;color:#6E4A0D">${alerts.map(a => `• ${esc(a)}`).join('<br>')}</div>` : ''}
  <p style="font-size:12px;color:#6B6F80;margin-top:16px">Sauvegarde de tes prêts en pièce jointe (fichier JSON). Garde-la : elle contient les contrats, les signatures et les coordonnées de tes proches.</p>
</div></body></html>`;
    const text = `Bilan CKMoney de ${prevMonthLabel}\nOn te doit ${eur(totalOwed)} (${rows.length} prêts en cours, ${lateRows.length} en retard).\n${rows.map(r => `- ${r.name} : ${eur(r.due)}${r.late ? ` (${r.late} j de retard)` : ''}`).join('\n')}\nIntérêts perçus : ${eur(interestMonth)} ce mois, ${eur(interestYear)} depuis janvier.\n${alerts.join('\n')}`;
    const backup = JSON.stringify({ app: 'CKMoney', exportedAt: new Date().toISOString(), lenderUid: uid, lenderCard: l.data(), profile, loans }, null, 2);
    const ok = await sendMail({
      to: email, subject: `CKMoney · Bilan et sauvegarde de ${prevMonthLabel}`, html, text,
      attachments: [{ filename: `ckmoney-sauvegarde-${today}.json`, content: backup, contentType: 'application/json' }],
    });
    if (ok) sent++;
  }
  return sent;
};
