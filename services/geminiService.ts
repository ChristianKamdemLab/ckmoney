
import { GoogleGenAI } from "@google/genai";
import { Loan } from "../types";

export const generateContractContent = async (loan: Loan): Promise<string> => {
  const lenderDetails = `${loan.lenderCivility || ''} ${loan.lenderName}, né(e) le ${loan.lenderBirthDate ? new Date(loan.lenderBirthDate).toLocaleDateString('fr-FR') : '___'} à ${loan.lenderBirthPlace || '___'}, résidant à ${loan.lenderAddress || '___'}`;
  const borrowerDetails = `${loan.borrowerCivility || ''} ${loan.borrowerName}, né(e) le ${loan.borrowerBirthDate ? new Date(loan.borrowerBirthDate).toLocaleDateString('fr-FR') : '___'} à ${loan.borrowerBirthPlace || '___'}, résidant à ${loan.borrowerAddress || '___'}`;
  
  const loanDateStr = new Date(loan.loanDate).toLocaleDateString('fr-FR');
  const repaymentDateStr = new Date(loan.repaymentDate).toLocaleDateString('fr-FR');
  const signedDateStr = new Date(loan.createdAt || new Date()).toLocaleDateString('fr-FR');
  const rate = loan.lateInterestRate || 0;

  // Construction de la clause de paiement dynamique
  let paymentClause = "Le remboursement pourra s'effectuer par virement bancaire ou tout autre moyen convenu entre les parties.";
  if (loan.lenderIban) {
      paymentClause += `\nCoordonnées Bancaires (IBAN) : ${loan.lenderIban}`;
  }
  if (loan.lenderPaymentLink) {
      paymentClause += `\nLien de paiement : ${loan.lenderPaymentLink}`;
  }

  const fallbackTemplate = `RECONNAISSANCE DE DETTE (Standardisé)

ENTRE LES SOUSSIGNÉS :

LE PRÊTEUR :
${lenderDetails}

ET

L'EMPRUNTEUR :
${borrowerDetails}

IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :

1. OBJET DU PRÊT
Le Prêteur consent ce jour à l'Emprunteur un prêt d'un montant principal de ${loan.amount} ${loan.currency}.
L'Emprunteur reconnaît avoir reçu cette somme ce jour par virement ou remise d'espèces.

2. REMBOURSEMENT ET DEVISE
L'Emprunteur s'engage irrévocablement à rembourser la totalité de la somme susmentionnée au plus tard le ${repaymentDateStr}.
Il est expressément convenu que bien que le prêt soit libellé en ${loan.currency}, le remboursement devra être effectué en EUROS (€) selon la contre-valeur au jour du paiement.

MODALITÉS DE REMBOURSEMENT :
${paymentClause}

ARTICLE : RETARD DE PAIEMENT
À défaut de remboursement intégral au ${repaymentDateStr}, le capital restant dû produira des intérêts de retard au taux annuel de ${rate} %. Ces intérêts courent de plein droit dès le lendemain de l'échéance. Le montant total des frais et intérêts ne pourra excéder le taux d'usure légal en vigueur.

3. LOI APPLICABLE ET JURIDICTION
Le présent contrat est soumis au droit en vigueur dans le pays de signature. En cas de litige, les tribunaux compétents seront ceux du domicile du Prêteur.

Fait à ${loan.city || '___'}, le ${signedDateStr} en deux exemplaires originaux.`;

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn("API Key manquante, utilisation du template local.");
        return fallbackTemplate;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Génère une reconnaissance de dette formelle et juridique en français. 
    
    IMPORTANT : 
    1. Le texte doit être structuré avec des sauts de ligne clairs.
    2. NE PAS INCLURE DE ZONE DE SIGNATURE DANS LE TEXTE GÉNÉRÉ. L'application les ajoute automatiquement.
    3. CLAUSE DE DEVISE : Le prêt est consenti en ${loan.currency}, mais le remboursement doit impérativement être effectué en EUROS (€). 
    4. MODALITÉS DE PAIEMENT : Intègre impérativement cette phrase : "${paymentClause}".
    5. INCLUS OBLIGATOIREMENT CETTE CLAUSE EXACTE :
       "ARTICLE : RETARD DE PAIEMENT
        À défaut de remboursement intégral au ${repaymentDateStr}, le capital restant dû produira des intérêts de retard au taux annuel de ${rate} %. Ces intérêts courent de plein droit dès le lendemain de l'échéance. Le montant total des frais et intérêts ne pourra excéder le taux d'usure légal en vigueur."
  
    ENTRE LES SOUSSIGNÉS :
    1. LE PRÊTEUR :
       ${lenderDetails}
    
    2. L'EMPRUNTEUR :
       ${borrowerDetails}
  
    DÉTAILS DU PRÊT :
    - Montant principal : ${loan.amount} ${loan.currency} (Préciser en toutes lettres)
    - Date du prêt (versement des fonds) : ${loanDateStr}
    - Échéance de remboursement : ${repaymentDateStr}
    
    FORMATAGE :
    - Titres en MAJUSCULES. Pas de markdown (* ou #).
    - Le texte doit STRICTEMENT se terminer par la phrase : "Fait à ${loan.city || '___'}, le ${signedDateStr} en deux exemplaires originaux."
    - NE RIEN ÉCRIRE APRÈS CETTE PHRASE (Pas de "Signatures", pas de "Prêteur", etc).`;
  
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.1 }
    });
    
    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    return text;

  } catch (error) {
    console.error("Erreur génération IA:", error);
    return fallbackTemplate;
  }
};
