
import React from 'react';
import { Screen, TopBar } from './v2/ui';

interface LegalDocsProps {
  view: 'cgu' | 'privacy';
  onClose: () => void;
}

const LegalDocs: React.FC<LegalDocsProps> = ({ view, onClose }) => {
  return (
    <Screen>
      <TopBar onBack={onClose} title={view === 'cgu' ? "Conditions d'utilisation" : 'Confidentialité'} />
      <div className="px-6 pt-2 pb-10 legal-doc">
        <div>
          {view === 'cgu' ? (
            <div >
              <div className="mb-5">
                
                <h1 className="text-[26px] font-bold leading-tight">Conditions Générales d'Utilisation</h1>
              </div>

              <div className="flex flex-col gap-6 text-[15px] leading-relaxed text-slate-700">
                 <section>
                    <h3 className="text-[17px] font-bold mb-1.5">1. Nature de l'outil</h3>
                    <p>
                        CKMoney est un outil personnel qui aide un particulier à formaliser et suivre les prêts occasionnels qu'il consent à des proches.
                        CKMoney n'est ni une banque, ni un établissement de crédit, ni un intermédiaire en financement participatif : il ne reçoit, ne détient
                        et ne transfère aucun fonds. Les paiements se font directement entre les parties.
                    </p>
                 </section>

                 <section>
                    <h3 className="text-[17px] font-bold mb-1.5">2. Prêts occasionnels uniquement</h3>
                    <p>
                        Les opérations de crédit à titre habituel sont réservées aux établissements agréés (article L. 511-5 du Code monétaire et financier).
                        Le prêteur atteste, pour chaque prêt, agir à titre personnel et occasionnel. L'application l'alerte lorsque le nombre de prêts consentis sur douze mois devient élevé.
                    </p>
                 </section>

                 <section>
                    <h3 className="text-[17px] font-bold mb-1.5">3. Taux d'intérêt</h3>
                    <p>
                        Le prêt est gratuit par défaut. Un taux conventionnel peut être fixé par écrit (article 1907 du Code civil) ; l'application le plafonne
                        au seuil de l'usure applicable au montant prêté (article L314-6 du Code de la consommation), et plafonne de même les intérêts de retard. Les intérêts perçus sont imposables pour le prêteur.
                    </p>
                 </section>

                 <section>
                    <h3 className="text-[17px] font-bold mb-1.5">4. Valeur des documents</h3>
                    <p>
                        Le contrat et la reconnaissance de dette sont rédigés à partir d'un modèle fixe et signés électroniquement (articles 1366 et 1367 du Code civil).
                        L'emprunteur saisit lui-même la somme en toutes lettres (article 1376). Le texte signé est figé par une empreinte SHA-256 conservée avec la date de chaque signature.
                        Il s'agit d'une signature électronique simple : en cas de contestation, il appartient au prêteur d'en démontrer la fiabilité. Pour un montant important, un acte notarié ou une signature électronique qualifiée offre une sécurité supérieure.
                    </p>
                 </section>

                 <section>
                    <h3 className="text-[17px] font-bold mb-1.5">5. Déclaration fiscale</h3>
                    <p>
                        Au-delà de 5 000 € prêtés entre les mêmes personnes au cours d'une année civile, le prêt doit être déclaré au moyen du formulaire n° 2062 (article 242 ter du Code général des impôts).
                        L'application signale ces cas mais n'effectue aucune déclaration à la place des parties.
                    </p>
                 </section>

                 <section>
                    <h3 className="text-[17px] font-bold mb-1.5">6. Limites</h3>
                    <p>
                        Les modèles et calculs sont fournis à titre d'aide et ne constituent pas un conseil juridique ou fiscal. Les taux de référence (usure, intérêt légal) sont mis à jour manuellement et doivent être vérifiés.
                    </p>
                 </section>
              </div>
            </div>
          ) : (
            <div >
              <div className="mb-5">
                
                <h1 className="text-[26px] font-bold leading-tight">Politique de Confidentialité</h1>
              </div>

              <div className="flex flex-col gap-6 text-[15px] leading-relaxed text-slate-700">
                 <section>
                    <h3 className="text-[17px] font-bold mb-1.5">1. Données traitées</h3>
                    <p>
                        Identité, date et lieu de naissance, adresse et email des parties, coordonnées de paiement du prêteur (IBAN, lien de paiement), montants,
                        échéances, paiements déclarés et signatures. Ces données sont nécessaires à l'établissement et à la preuve du contrat.
                    </p>
                 </section>

                 <section>
                    <h3 className="text-[17px] font-bold mb-1.5">2. Hébergement et accès</h3>
                    <p>
                        Les données sont stockées dans Google Firebase (Firestore). Des règles de sécurité limitent l'accès à chaque prêt à son prêteur et à son emprunteur,
                        identifiés par une adresse email vérifiée. Aucune donnée n'est vendue ni transmise à des tiers.
                    </p>
                 </section>

                 <section>
                    <h3 className="text-[17px] font-bold mb-1.5">3. Durée de conservation et droits</h3>
                    <p>
                        Les données sont conservées jusqu'à cinq ans après le remboursement complet, durée de prescription de l'action en paiement (article 2224 du Code civil).
                        Vous pouvez demander l'accès, la rectification ou l'effacement de vos données au prêteur, dans la limite de ce qui est nécessaire à la preuve du contrat (RGPD, articles 15 à 17).
                    </p>
                 </section>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </Screen>
  );
};

export default LegalDocs;
