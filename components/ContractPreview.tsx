import React, { useEffect } from 'react';
import { Loan } from '../types';
import { ArrowLeft, Download } from 'lucide-react';
import { amountWordsMatch } from '../utils/frenchNumbers';
import { formatMoney, parseISODate, scheduleForLoan, effectiveLateRate } from '../utils/schedule';
import { LEGAL_INTEREST_RATE } from '../config/legal';
import { buildLoanContract } from '../utils/contract';

interface ContractPreviewProps {
  loan: Loan;
  onClose: () => void;
  autoPrint?: boolean;
}

// Charte CKLabs
const INK = '#1C2551';
const OCHRE = '#C98A1E';
const RULE = '#D9D2C3';
const MUTE = '#6B6F80';
const SOFT = '#EEF0F6';
const OCHRE_LIGHT = '#F6EBD6';

const fmt = (iso: string) => parseISODate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^1 /, '1er ');

/**
 * Rendu du texte signé : le texte n'est jamais réécrit (il est figé par son empreinte),
 * seule sa mise en forme change. Les lignes d'échéance deviennent un tableau.
 */
const RenderText: React.FC<{ text: string; skipTitleLines?: number }> = ({ text, skipTitleLines = 0 }) => {
  const lines = text.split('\n').slice(skipTitleLines);
  const out: React.ReactNode[] = [];
  let rows: string[] = [];
  const flushRows = (key: string) => {
    if (!rows.length) return;
    out.push(
      <table key={key} className="ck-table">
        <thead><tr><th>Échéance</th><th>Date</th><th className="r">Montant</th><th className="r">Capital</th><th className="r">Intérêts</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const m = r.trim().match(/^Échéance (\d+) — (.+?) : (.+?) \(capital (.+?), intérêts (.+?)\)$/);
            return m
              ? <tr key={i}><td>{m[1]}</td><td>{m[2]}</td><td className="r b">{m[3]}</td><td className="r">{m[4]}</td><td className="r">{m[5]}</td></tr>
              : <tr key={i}><td colSpan={5}>{r.trim()}</td></tr>;
          })}
        </tbody>
      </table>,
    );
    rows = [];
  };
  lines.forEach((line, i) => {
    if (line.startsWith('  Échéance')) { rows.push(line); return; }
    flushRows(`t${i}`);
    const t = line.trim();
    if (!t) return;
    const art = t.match(/^ARTICLE (\d+) – (.+)$/);
    if (art) {
      out.push(<h3 key={i} className="ck-art"><span>{art[1].padStart(2, '0')}</span>{art[2].charAt(0) + art[2].slice(1).toLowerCase()}</h3>);
    } else if (/^(ENTRE LES SOUSSIGNÉS|ET|IL A ÉTÉ CONVENU CE QUI SUIT) ?:?$/.test(t)) {
      out.push(<p key={i} className="ck-label">{t.replace(/ ?:$/, '')}</p>);
    } else if (/^\(Article/.test(t)) {
      out.push(<p key={i} className="ck-note">{t}</p>);
    } else {
      out.push(<p key={i}>{t}</p>);
    }
  });
  flushRows('end');
  return <>{out}</>;
};

const ContractPreview: React.FC<ContractPreviewProps> = ({ loan, onClose, autoPrint }) => {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => window.print(), 800);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  const schedule = scheduleForLoan(loan);
  const total = schedule.reduce((s, i) => s + i.amount, 0);
  const lateRate = effectiveLateRate(loan, LEGAL_INTEREST_RATE);
  const ref = `CKM-${loan.id.slice(0, 6).toUpperCase()}`;
  const lenderSignedAt = new Date(loan.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const borrowerSignedAt = loan.borrowerSignedAt
    ? new Date(loan.borrowerSignedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
    : null;
  const mentionOk = loan.borrowerAmountWords ? amountWordsMatch(loan.borrowerAmountWords, loan.amount) : false;
  const hashOk = !!loan.borrowerSignedHash && loan.borrowerSignedHash === loan.contractHash;
  const short = (name: string) => { const [f, ...r] = name.split(' '); return r.length ? `${f} ${r[r.length - 1].charAt(0)}.` : f; };

  const kpis = [
    ['Montant prêté', formatMoney(loan.amount, loan.currency)],
    ['Remboursement', schedule.length > 1 ? `${schedule.length} × ${formatMoney(schedule[0].amount, loan.currency)}` : `le ${fmt(schedule[0].dueDate)}`],
    ['Intérêts', loan.interestRate ? `${loan.interestRate.toLocaleString('fr-FR')} % / an` : 'Sans intérêt'],
    ['Si retard', loan.lateRateMode === 'none' ? 'Aucune pénalité' : loan.lateRateMode === 'legal' ? 'Taux légal' : `${lateRate.toLocaleString('fr-FR')} % / an`],
  ];

  const ackText = (loan.acknowledgmentText || '').replace(
    '« Bon pour la somme de [mention de l’Emprunteur] »',
    '[[MENTION]]',
  );

  return (
    <div className="ck-doc-wrap min-h-screen" style={{ background: '#F1EFE9' }}>
      <style>{`
        .ck-doc{font-family:'Figtree',system-ui,sans-serif;color:#22263A;font-size:10pt;line-height:1.45}
        .ck-doc p{margin:0 0 4pt}
        .ck-doc .serif{font-family:'Source Serif 4',Georgia,serif}
        .ck-art{display:flex;gap:8pt;align-items:baseline;font-family:'Source Serif 4',Georgia,serif;font-weight:600;font-size:12pt;color:${INK};margin:9pt 0 2pt;break-after:avoid}
        .ck-art span{font-family:'Figtree',sans-serif;font-size:8.5pt;font-weight:800;color:${OCHRE};letter-spacing:.08em}
        .ck-label{font-size:7.5pt;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${OCHRE};margin:10pt 0 3pt!important}
        .ck-note{font-size:8.5pt;color:${MUTE}}
        .ck-table{width:100%;border-collapse:collapse;margin:4pt 0 6pt;font-size:8.8pt;break-inside:avoid}
        .ck-table th{background:${INK};color:#fff;text-align:left;padding:4pt 6pt;font-weight:700;font-size:8pt;letter-spacing:.04em}
        .ck-table td{padding:2.5pt 6pt;border-bottom:.5pt solid ${RULE}}
        .ck-table .r{text-align:right}.ck-table .b{font-weight:700;color:${INK}}
        .ck-page{background:#fff;max-width:210mm;margin:0 auto;padding:16mm 16mm 14mm;box-shadow:0 10px 40px rgba(28,37,81,.08)}
        .ck-page + .ck-page{margin-top:24px}
        @media screen and (max-width:640px){
          .ck-doc{font-size:15.5px;line-height:1.6}
          .ck-doc p{margin:0 0 10px}
          .ck-page{padding:22px 18px 24px;border-radius:18px}
          .ck-page + .ck-page{margin-top:14px}
          .ck-art{font-size:18px;margin:24px 0 8px;gap:10px}
          .ck-art span{font-size:12px}
          .ck-label{font-size:11px;margin:18px 0 6px!important}
          .ck-note{font-size:13px}
          .ck-table{font-size:14.5px;margin:8px 0 14px}
          .ck-table th{font-size:12px;padding:7px 8px}
          .ck-table td{padding:8px}
          .ck-table th:nth-child(4),.ck-table th:nth-child(5),.ck-table td:nth-child(4),.ck-table td:nth-child(5){display:none}
          .ck-h1{font-size:26px!important}
          .ck-h2{font-size:24px!important}
          .ck-meta{font-size:12.5px!important;text-align:left!important}
          .ck-kpi-k{font-size:10px!important}
          .ck-kpi-v{font-size:17px!important}
          .ck-small{font-size:12.5px!important}
          .ck-quote{font-size:17px!important}
          .ck-proof{font-size:11.5px!important}
        }
        @media print{
          @page{size:A4;margin:14mm 16mm 16mm;
            @bottom-left{content:"CKMoney · Contrat ${ref}";font:500 7.5pt Figtree,sans-serif;color:${MUTE}}
            @bottom-right{content:counter(page) " / " counter(pages);font:700 7.5pt Figtree,sans-serif;color:${INK}}}
          html,body{background:#fff!important}
          .no-print{display:none!important}
          .ck-doc-wrap{background:#fff!important;min-height:0!important}
          .ck-page{box-shadow:none;padding:0;max-width:none}
          .ck-page + .ck-page{margin-top:0;break-before:page}
        }
      `}</style>

      {/* Barre d'outils */}
      <div className="no-print sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[210mm] mx-auto px-4 py-3 flex justify-between items-center">
          <button onClick={onClose} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
            <ArrowLeft size={18} /> Retour
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: INK }}>
            <Download size={16} /> Télécharger le PDF
          </button>
        </div>
      </div>

      <div className="ck-doc py-4 sm:py-10 px-3 sm:px-4 print:p-0">
        {/* PAGE 1 : CONTRAT */}
        <section className="ck-page">
          <header className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-6 pb-4 mb-5" style={{ borderBottom: `1.5pt solid ${INK}` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-sm" style={{ background: OCHRE }}>CK</div>
              <div className="leading-none">
                <div className="font-black text-lg" style={{ color: INK }}>CK<span style={{ color: OCHRE }}>Money</span></div>
                <div className="text-[7pt] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: MUTE }}>Une app CKLabs</div>
              </div>
            </div>
            <div className="ck-meta text-right text-[8.5pt]" style={{ color: MUTE }}>
              <div className="font-bold" style={{ color: INK }}>Contrat {ref}</div>
              <div>Établi le {lenderSignedAt}</div>
              <div>{loan.borrowerSignedAt ? 'Signé par les deux parties' : 'En attente de la signature de l’emprunteur'}</div>
            </div>
          </header>

          <p className="ck-label" style={{ marginTop: 0 }}>Contrat de prêt entre particuliers</p>
          <h1 className="ck-h1 serif font-semibold leading-tight mb-4" style={{ color: INK, fontSize: '22pt' }}>
            {formatMoney(loan.amount, loan.currency)} prêtés par {short(loan.lenderName)} à {short(loan.borrowerName)}
          </h1>

          {/* L'essentiel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mb-5 rounded-lg overflow-hidden" style={{ background: RULE }}>
            {kpis.map(([k, v]) => (
              <div key={k} className="p-3" style={{ background: SOFT }}>
                <div className="ck-kpi-k text-[7pt] font-extrabold uppercase tracking-[0.14em]" style={{ color: OCHRE }}>{k}</div>
                <div className="ck-kpi-v serif font-semibold text-[12pt] leading-snug mt-0.5" style={{ color: INK }}>{v}</div>
              </div>
            ))}
          </div>
          {loan.interestRate ? (
            <p className="ck-small text-[8.5pt] -mt-3 mb-4" style={{ color: MUTE }}>Total à rembourser : {formatMoney(total, loan.currency)}, dont {formatMoney(total - loan.amount, loan.currency)} d’intérêts.</p>
          ) : null}

          {loan.contractText
            ? <RenderText text={loan.contractText} skipTitleLines={2} />
            : <>
                <p style={{ fontStyle: 'italic', color: '#6B6F80' }}>Projet de contrat : l'identité de l'emprunteur sera complétée au moment où il signe.</p>
                <RenderText text={buildLoanContract({ ...loan, borrowerName: loan.borrowerSignedName || loan.borrowerName || '___', schedule })} skipTitleLines={2} />
              </>}

          {/* Signatures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4 pt-3" style={{ borderTop: `.5pt solid ${RULE}`, breakInside: 'avoid' }}>
            {[
              { role: 'Le Prêteur', name: loan.lenderName, sig: loan.lenderSignature, when: `Signé électroniquement le ${lenderSignedAt}` },
              { role: 'L’Emprunteur', name: loan.borrowerSignedName || loan.borrowerName, sig: loan.borrowerSignature, when: borrowerSignedAt ? `Lu et approuvé — signé électroniquement le ${borrowerSignedAt}` : 'Lu et approuvé, date et signature' },
            ].map(b => (
              <div key={b.role}>
                <p className="ck-label" style={{ marginTop: 0 }}>{b.role}</p>
                <p className="ck-small font-bold text-[10pt]" style={{ color: INK }}>{b.name}</p>
                <div className="h-12 my-1 flex items-center">
                  {b.sig ? <img src={b.sig} alt={`Signature ${b.role}`} className="max-h-full object-contain" /> : <div className="w-full h-full" style={{ borderBottom: `.5pt solid ${RULE}` }} />}
                </div>
                <p className="ck-small text-[8pt]" style={{ color: MUTE }}>{b.when}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PAGE 2 : RECONNAISSANCE DE DETTE */}
        {loan.acknowledgmentText && (
          <section className="ck-page">
            <p className="ck-label" style={{ marginTop: 0 }}>Annexe · Article 1376 du Code civil</p>
            <h2 className="ck-h2 serif font-semibold mb-4" style={{ color: INK, fontSize: '18pt' }}>Reconnaissance de dette</h2>
            {ackText.split('[[MENTION]]').map((part, i) => (
              <React.Fragment key={i}>
                <RenderText text={part} skipTitleLines={i === 0 ? 2 : 0} />
                {i === 0 && (
                  <div className="my-3 p-4 rounded-lg" style={{ background: OCHRE_LIGHT, borderLeft: `3pt solid ${OCHRE}` }}>
                    <p className="ck-quote serif text-[12pt] italic" style={{ color: INK, margin: 0 }}>
                      « Bon pour la somme de {loan.borrowerAmountWords || '………………………………………………'} ({formatMoney(loan.amount, loan.currency)}) »
                    </p>
                  </div>
                )}
              </React.Fragment>
            ))}
            <div className="mt-4 max-w-xs" style={{ breakInside: 'avoid' }}>
              <p className="ck-label">Signature de l’Emprunteur</p>
              {loan.borrowerSignature
                ? <img src={loan.borrowerSignature} alt="Signature" className="h-16 object-contain" />
                : <div className="h-16" style={{ borderBottom: `.5pt solid ${RULE}` }} />}
            </div>

            {loan.contractHash && (
              <div className="ck-proof mt-8 p-3 rounded-lg text-[7.5pt] leading-relaxed" style={{ background: SOFT, color: MUTE }}>
                <p className="font-extrabold uppercase tracking-[0.14em] text-[7pt] mb-1" style={{ color: INK }}>Dossier de preuve électronique</p>
                <p style={{ margin: 0 }}>Modèle CKMoney {loan.contractVersion || ''}, texte fixe. Empreinte SHA-256 : <span className="font-mono break-all">{loan.contractHash}</span></p>
                <p style={{ margin: 0 }}>Prêteur : {loan.lenderEmail}, le {lenderSignedAt}.{loan.borrowerSignedAt && <> Emprunteur : {loan.borrowerEmail}, le {borrowerSignedAt} ; texte {hashOk ? 'identique à l’original ✓' : 'DIFFÉRENT ✗'} ; mention en lettres {mentionOk ? 'concordante ✓' : 'à vérifier ✗'}.</>}</p>
              </div>
            )}
            {loan.signedContractUrl && (
              <div className="mt-8">
                <p className="ck-label">Contrat papier signé (copie)</p>
                <img src={loan.signedContractUrl} className="max-w-full border rounded-lg" alt="Contrat scanné" />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default ContractPreview;
