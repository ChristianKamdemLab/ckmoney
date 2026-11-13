import React from 'react';
import { Screen, TopBar } from './v2/ui';

// Conditions d'utilisation et politique de confidentialité (version du 13 novembre 2026 : prêt ouvert à
// tous les comptes, CKMoney reste un outil entre personnes qui se connaissent, jamais une plateforme).

interface LegalDocsProps {
  view: 'cgu' | 'privacy';
  onClose: () => void;
}

type Section = { t: string; p: string[] };

const UPDATED = '13 novembre 2026';

const CGU: Section[] = [
  { t: '1. Objet et éditeur', p: [
    "CKMoney est une application éditée par Christian Kamdem (CKLabs), à titre non professionnel. Elle aide des particuliers qui se connaissent à formaliser et suivre les prêts d'argent occasionnels qu'ils se consentent, et propose aussi des articles, des recommandations (Radio CK), des sorties et des jeux entre amis.",
    "L'application est hébergée par Vercel Inc. (site et fonctions serveur) et par Google (Firebase : comptes, base de données, notifications). Contact : ckmoneyapp@gmail.com.",
  ] },
  { t: '2. Un outil, pas une plateforme', p: [
    "CKMoney ne met pas en relation des personnes qui ne se connaissent pas : il n'existe ni annuaire de prêteurs, ni recherche d'emprunteurs. Un prêt se fait toujours entre deux personnes qui se connaissent, par un lien personnel envoyé par l'une à l'autre.",
    "CKMoney n'est ni une banque, ni un établissement de crédit, ni un intermédiaire en financement : l'application ne reçoit, ne détient et ne transfère aucun fonds, et ne perçoit aucune commission. Les paiements se font directement entre les parties (virement, PayPal, etc.).",
  ] },
  { t: '3. Compte', p: [
    "L'application est réservée aux personnes majeures. Le compte se crée avec Google ou une adresse e-mail ; chacun est responsable des informations qu'il saisit, qui doivent être exactes, et de la sécurité de l'accès à son compte. Un compte par personne.",
  ] },
  { t: '4. Prêter', p: [
    "Tout compte peut prêter à ses proches (« Prêter à mes proches »). Le prêteur prête ses propres fonds, à titre personnel et occasionnel : les opérations de crédit à titre habituel sont réservées aux établissements agréés (article L. 511-5 du Code monétaire et financier). L'application l'alerte lorsque le nombre de prêts consentis sur douze mois devient élevé.",
    "Le prêt est gratuit par défaut. Un taux conventionnel peut être fixé par écrit (article 1907 du Code civil) ; l'application le plafonne au seuil de l'usure applicable au montant prêté (article L. 314-6 du Code de la consommation), et plafonne de même les intérêts de retard. Une pénalité forfaitaire de retard peut être prévue, dans la limite de 10 % (le juge peut réduire une clause pénale excessive, article 1231-5 du Code civil). Les intérêts perçus sont imposables pour le prêteur.",
    "Au-delà de 5 000 € prêtés entre les mêmes personnes au cours d'une année civile, le prêt doit être déclaré (formulaire n° 2062, article 242 ter du Code général des impôts). L'application le signale mais ne déclare rien à la place des parties.",
  ] },
  { t: '5. Contrats et preuve', p: [
    "Le contrat et la reconnaissance de dette sont rédigés à partir d'un modèle fixe et signés électroniquement (articles 1366 et 1367 du Code civil). L'emprunteur écrit lui-même la somme en toutes lettres (article 1376). Le texte signé est figé par une empreinte SHA-256, conservée avec la date et l'heure de chaque signature et l'identifiant de chaque signataire.",
    "Il s'agit d'une signature électronique simple : en cas de contestation, il appartient à celui qui s'en prévaut d'en démontrer la fiabilité. Pour un montant important, un acte notarié ou une signature électronique qualifiée offre une sécurité supérieure.",
  ] },
  { t: '6. Litiges entre les parties', p: [
    "CKMoney n'est pas partie aux prêts et n'arbitre pas les désaccords. En cas de litige, les parties cherchent d'abord un accord amiable ; à défaut, le contrat signé et l'historique des paiements conservés dans l'application font foi devant les juridictions compétentes ou les autorités saisies.",
  ] },
  { t: '7. Contenus et propriété intellectuelle', p: [
    "L'application, son code, son design, son nom, ses logos et les contenus publiés par l'éditeur (articles, textes de Radio CK, synthèses de la revue de presse, annonces) sont protégés par le droit d'auteur. Toute reproduction, copie, extraction ou réutilisation, même partielle, sans autorisation écrite est interdite.",
    "Les fiches de revue de presse sont des synthèses rédigées pour CKMoney, avec leur source ; les articles d'origine appartiennent à leurs éditeurs. Les podcasts et vidéos de Radio CK sont lus avec les lecteurs officiels des plateformes (YouTube, Spotify, Apple Podcasts, Deezer) et appartiennent à leurs auteurs.",
  ] },
  { t: '8. Ce que publient les membres', p: [
    "Commentaires, réactions, sorties et réponses sont publiés sous la responsabilité de leur auteur et visibles par les autres membres concernés. Ils doivent rester respectueux et légaux, et ne pas exposer d'informations personnelles sur autrui. L'éditeur peut retirer un contenu qui ne respecte pas ces règles.",
  ] },
  { t: '9. Usages interdits', p: [
    "Il est interdit d'utiliser CKMoney pour : prêter à titre habituel ou à un taux usuraire ; frauder, blanchir de l'argent ou contourner une obligation légale ; harceler ou démarcher ; tenter d'accéder aux données d'autres comptes ou aux systèmes de l'application ; en extraire des données de façon automatisée ; copier ou reproduire l'application. Tout manquement peut entraîner la suspension ou la suppression du compte, sans préjudice de poursuites.",
  ] },
  { t: '10. Limites', p: [
    "Les modèles, calculs et rappels sont une aide et ne constituent pas un conseil juridique ou fiscal. Les taux de référence (usure, intérêt légal) sont mis à jour régulièrement mais doivent être vérifiés. L'application est fournie en l'état ; sa disponibilité n'est pas garantie.",
  ] },
  { t: '11. Évolution et droit applicable', p: [
    "Ces conditions peuvent évoluer ; la version en vigueur est toujours consultable ici. Elles sont soumises au droit français.",
  ] },
];

const PRIVACY: Section[] = [
  { t: '1. Responsable', p: [
    "Christian Kamdem (CKLabs), éditeur de CKMoney. Chaque prêteur n'utilise les données de ses emprunteurs que pour leurs contrats communs, et inversement.",
  ] },
  { t: '2. Données traitées', p: [
    "Compte : adresse e-mail, nom, mode de connexion. Identité figurant dans les contrats : civilité, nom, date et lieu de naissance, adresse. Paiement : IBAN, lien de paiement, moyen de réception de l'argent. Prêts : montants, échéances, paiements, demandes, mentions manuscrites, signatures et empreintes des contrats. Usage : jetons de notification, commentaires, réactions, sorties et réponses, journaux techniques du serveur.",
  ] },
  { t: '3. Pourquoi', p: [
    "Établir, signer, prouver et suivre les contrats de prêt (exécution du contrat) ; envoyer les rappels et notifications que tu as activés (consentement) ; assurer la sécurité de l'application et prévenir les abus (intérêt légitime). Aucune publicité, aucun profilage, aucune revente.",
  ] },
  { t: '4. Qui y a accès', p: [
    "Un prêt n'est visible que par son prêteur et son emprunteur ; ton profil, par toi seul ; l'autre partie voit ce qui figure dans votre contrat. Ton prénom apparaît à côté de tes commentaires pour les autres membres. Seul l'éditeur peut voir la liste des comptes (prénoms), pour l'administration.",
    "Prestataires techniques, qui traitent les données pour le compte de l'application : Google (Firebase : comptes, base de données, notifications ; Gmail : e-mails, envoyés depuis l'adresse de l'appli), Vercel (hébergement et fonctions serveur). Ils peuvent traiter des données hors de l'Union européenne, avec les garanties prévues par le RGPD (clauses contractuelles types ou cadre de protection des données UE–États-Unis).",
  ] },
  { t: '5. Durée de conservation', p: [
    "Les contrats et leurs données sont conservés jusqu'à cinq ans après le dernier paiement, durée de prescription de l'action en paiement (article 2224 du Code civil). Le reste est conservé tant que le compte existe ; un commentaire ou une sortie supprimé disparaît immédiatement.",
  ] },
  { t: '6. Sécurité', p: [
    "Connexion chiffrée (HTTPS) ; règles d'accès vérifiées côté serveur pour chaque donnée ; aucun mot de passe stocké par CKMoney (connexion gérée par Google et Firebase) ; contrats figés par empreinte ; contrôles de sécurité réguliers de l'application.",
  ] },
  { t: '7. Tes droits', p: [
    "Tu peux demander l'accès, la rectification, l'effacement, la limitation ou la portabilité de tes données, ou t'opposer à un traitement, en écrivant à ckmoneyapp@gmail.com. L'effacement ne peut pas porter sur ce qui reste nécessaire à la preuve d'un contrat en cours de conservation. Tu peux aussi saisir la CNIL (cnil.fr).",
  ] },
  { t: '8. Cookies et stockage', p: [
    "CKMoney n'utilise pas de cookies publicitaires. Le navigateur garde seulement ce qui fait fonctionner l'appli (connexion, préférences). Dans Radio CK, le lecteur YouTube (version sans cookies) ou Spotify, Apple Podcasts et Deezer ne se charge que lorsque tu appuies sur lecture ; ces plateformes appliquent alors leurs propres règles.",
  ] },
];

const LegalDocs: React.FC<LegalDocsProps> = ({ view, onClose }) => {
  const doc = view === 'cgu' ? CGU : PRIVACY;
  return (
    <Screen>
      <TopBar onBack={onClose} title={view === 'cgu' ? "Conditions d'utilisation" : 'Confidentialité'} />
      <div className="px-6 pt-2 pb-10 legal-doc">
        <h1 className="text-[26px] font-bold leading-tight">{view === 'cgu' ? "Conditions générales d'utilisation" : 'Politique de confidentialité'}</h1>
        <div className="text-[13px] mt-1.5 mb-5 text-slate-500">Mise à jour le {UPDATED}</div>
        <div className="flex flex-col gap-6 text-[15px] leading-relaxed text-slate-700">
          {doc.map(s => (
            <section key={s.t}>
              <h3 className="text-[17px] font-bold mb-1.5">{s.t}</h3>
              {s.p.map((x, i) => <p key={i} className={i ? 'mt-2' : ''}>{x}</p>)}
            </section>
          ))}
        </div>
      </div>
    </Screen>
  );
};

export default LegalDocs;
