
import React, { useEffect } from 'react';
import { Loan } from '../types';
import { Printer, ArrowLeft, ShieldCheck } from 'lucide-react';
import { amountWordsMatch } from '../utils/frenchNumbers';
import { formatMoney } from '../utils/schedule';

interface ContractPreviewProps {
  loan: Loan;
  onClose: () => void;
  autoPrint?: boolean;
}

const ContractPreview: React.FC<ContractPreviewProps> = ({ loan, onClose, autoPrint }) => {
  const handlePrint = () => {
    window.print();
  };
  
  // Déclenchement automatique de l'impression si demandé
  useEffect(() => {
    if (autoPrint) {
        const timer = setTimeout(() => {
            window.print();
        }, 800);
        return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const formattedSignedDate = new Date(loan.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const borrowerSignedAt = loan.borrowerSignedAt
    ? new Date(loan.borrowerSignedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
    : null;
  const mentionOk = loan.borrowerAmountWords ? amountWordsMatch(loan.borrowerAmountWords, loan.amount) : false;
  const hashOk = !!loan.borrowerSignedHash && loan.borrowerSignedHash === loan.contractHash;
  const mention = loan.borrowerAmountWords
    ? `« Bon pour la somme de ${loan.borrowerAmountWords} (${formatMoney(loan.amount, loan.currency)}) »`
    : '« Bon pour la somme de ……………………………… »';
  const paragraphs = (text: string) => text.split('\n').map((para, i) =>
    para.trim()
      ? <p key={i} className={`break-words ${/^(ARTICLE|CONTRAT|RECONNAISSANCE|ENTRE|IL A ÉTÉ)/.test(para) ? 'font-bold' : ''} ${para.startsWith('  ') ? 'pl-4 text-sm sm:text-base' : ''}`}>{para.trim()}</p>
      : <div key={i} className="h-2" />);

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[100] flex sm:items-center sm:justify-center print:bg-white print:block print:relative print:z-0 print:p-0">
      
      {/* Styles spécifiques pour l'impression haute lisibilité */}
      <style>{`
        @media print {
          body, p, div, span, li {
            font-size: 12pt !important;
            line-height: 1.6 !important;
            color: black !important;
          }
          h1 {
            font-size: 24pt !important;
            font-weight: 900 !important;
            margin-bottom: 0.5cm !important;
          }
          h2, h3, .uppercase {
            font-size: 14pt !important;
            font-weight: bold !important;
          }
          .text-xs {
             font-size: 10pt !important;
          }
          .leading-relaxed {
             line-height: 1.8 !important;
          }
          .no-print {
             display: none !important;
          }
        }
      `}</style>

      {/* Container Principal : Pleine hauteur écran mobile (100dvh pour gérer la barre URL mobile) */}
      <div className="w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden print:shadow-none print:h-auto print:max-w-none print:rounded-none">
        
        {/* BARRE D'OUTILS FIXE EN HAUT - Z-Index élevé pour rester au dessus du texte */}
        <div className="bg-white border-b border-slate-100 px-4 py-4 sm:px-6 flex justify-between items-center z-50 shrink-0 no-print shadow-sm">
          <button 
            onClick={onClose} 
            className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase tracking-widest px-5 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all active:scale-95 touch-manipulation"
          >
            <ArrowLeft size={20} />
            Retour
          </button>
          
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 touch-manipulation"
          >
            <Printer size={20} />
            <span className="hidden sm:inline">Imprimer / PDF</span>
          </button>
        </div>

        {/* ZONE DE CONTENU DÉFILANTE - Scroll fluide natif */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-12 md:p-20 bg-white relative scroll-smooth overscroll-contain">
          
          <div className="max-w-full mx-auto text-slate-900 relative z-10 print:text-black pb-32 sm:pb-0">
            
            {/* Header Document */}
            <div className="text-center mb-10 sm:mb-16">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-6 print:border-2 print:border-black print:text-black print:bg-white">
                <ShieldCheck size={14} />
                {loan.borrowerSignedAt ? 'Signé électroniquement' : 'En attente de signature'}
              </div>
              <h1 className="serif text-2xl sm:text-4xl mb-6 font-bold tracking-tight leading-tight uppercase">{loan.acknowledgmentText ? 'Contrat de prêt' : 'Reconnaissance de Dette'}</h1>
              <div className="w-16 h-1.5 bg-indigo-600 mx-auto rounded-full print:bg-black"></div>
            </div>

            {/* Corps du texte */}
            <div className="serif text-base sm:text-xl leading-relaxed text-justify space-y-6 sm:space-y-10 text-slate-800 print:text-black print:text-[12pt] print:leading-normal antialiased">
              {loan.contractText ? (
                paragraphs(loan.contractText)
              ) : (
                <div className="text-center py-20 text-slate-300 animate-pulse">
                  Chargement du contrat...
                </div>
              )}
            </div>

            {/* ZONE DE SIGNATURES */}
            <div className="mt-16 pt-8 border-t-2 border-slate-200 print:border-black print:mt-12 page-break-avoid">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 print:gap-8 items-start">
                
                {/* Bloc Prêteur */}
                <div className="flex flex-col text-left">
                  <p className="font-bold uppercase text-slate-900 mb-4 text-xs sm:text-sm print:text-black tracking-widest">LE PRÊTEUR</p>
                  
                  <div className="h-20 sm:h-24 mb-2 flex items-center justify-start relative">
                    {loan.lenderSignature ? (
                      <img 
                        src={loan.lenderSignature} 
                        alt="Signature Prêteur" 
                        className="max-h-full max-w-full object-contain" 
                      />
                    ) : (
                      <span className="text-slate-300 text-xs italic">Non signé</span>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-slate-500 italic print:text-black font-medium">
                     Signé électroniquement le {formattedSignedDate} via CKMoney
                  </p>
                </div>

                {/* Bloc Emprunteur */}
                <div className="flex flex-col text-left mt-8 sm:mt-0">
                   <p className="font-bold uppercase text-slate-900 mb-4 text-xs sm:text-sm print:text-black tracking-widest">L'EMPRUNTEUR</p>
                   
                   {loan.borrowerSignature ? (
                     <>
                       <p className="text-[11px] text-slate-600 mb-2 print:text-black italic">Lu et approuvé — {loan.borrowerSignedName}</p>
                       <div className="h-20 sm:h-24 mb-2 flex items-center justify-start">
                         <img src={loan.borrowerSignature} alt="Signature Emprunteur" className="max-h-full max-w-full object-contain" />
                       </div>
                       <p className="text-[10px] text-slate-500 italic print:text-black font-medium">Signé électroniquement le {borrowerSignedAt} via CKMoney</p>
                     </>
                   ) : (
                     <>
                       <p className="text-[11px] text-slate-600 mb-4 print:text-black leading-tight italic">
                         Mention "Lu et approuvé" suivie de la signature :
                       </p>
                       <div className="h-20 sm:h-24 w-full"></div>
                       <div className="border-b border-slate-300 print:border-black w-3/4"></div>
                     </>
                   )}
                </div>

              </div>
              
              {/* Reconnaissance de dette (signée par l'emprunteur seul) */}
              {loan.acknowledgmentText && (
                <div className="mt-16 pt-12 border-t-4 border-slate-200 print:border-black" style={{ pageBreakBefore: 'always' }}>
                  <div className="serif text-base sm:text-xl leading-relaxed text-justify space-y-6 text-slate-800 print:text-black print:text-[12pt]">
                    {paragraphs(loan.acknowledgmentText.replace('« Bon pour la somme de [mention de l’Emprunteur] »', mention))}
                  </div>
                  <div className="mt-8 max-w-sm">
                    <p className="font-bold uppercase text-slate-900 mb-2 text-xs tracking-widest print:text-black">Signature de l'Emprunteur</p>
                    {loan.borrowerSignature
                      ? <img src={loan.borrowerSignature} alt="Signature" className="h-20 object-contain" />
                      : <div className="h-20 border-b border-slate-300 print:border-black" />}
                  </div>
                </div>
              )}

              {/* Dossier de preuve */}
              {loan.contractHash && (
                <div className="mt-12 p-4 border border-slate-200 rounded-xl text-[10px] text-slate-500 font-mono space-y-1 print:text-black print:border-black page-break-avoid">
                  <p className="font-sans font-bold uppercase tracking-widest text-slate-700 print:text-black">Dossier de preuve électronique</p>
                  <p>Modèle : CKMoney {loan.contractVersion || ''} — texte fixe, sans génération automatique</p>
                  <p>Empreinte SHA-256 du texte : {loan.contractHash}</p>
                  <p>Prêteur : {loan.lenderEmail} — signé le {formattedSignedDate}</p>
                  {loan.borrowerSignedAt && <>
                    <p>Emprunteur : {loan.borrowerEmail} — signé le {borrowerSignedAt}</p>
                    <p>Empreinte au moment de la signature : {hashOk ? 'identique ✓' : 'DIFFÉRENTE ✗'}</p>
                    <p>Mention en lettres saisie par l'emprunteur : « {loan.borrowerAmountWords} » — {mentionOk ? 'concorde avec le montant ✓' : 'à vérifier ✗'}</p>
                  </>}
                </div>
              )}

              {/* Mentions légales bas de page */}
              <div className="mt-12 text-center text-[9px] text-slate-400 print:text-black print:mt-8">
                  <p>Document établi avec CKMoney, outil personnel de gestion de prêts entre proches. Signature électronique simple (art. 1366-1367 C. civ.).</p>
              </div>

              {/* Annexe Scannée */}
              {loan.signedContractUrl && (
                  <div className="mt-12 pt-12 border-t-4 border-slate-200 page-break-avoid print:block">
                      <h3 className="text-center font-bold uppercase mb-4 text-sm">Annexe : Contrat Scanné</h3>
                      <img src={loan.signedContractUrl} className="max-w-full mx-auto border shadow-lg rounded-xl" alt="Contrat scanné" />
                  </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractPreview;
