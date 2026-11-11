# CKMoney — prêts entre proches

Application personnelle pour formaliser et suivre les prêts d'argent occasionnels consentis à des amis ou à la famille :
contrat de prêt et reconnaissance de dette conformes au droit français, signature en ligne par l'emprunteur,
échéancier, suivi des paiements et rappels fiscaux.

CKMoney n'est ni une banque ni un intermédiaire : aucun fonds ne transite par l'application.

## Ce que fait l'application

- **Contrat + reconnaissance de dette** rédigés à partir d'un modèle fixe (`utils/contract.ts`), sans IA, figés par une empreinte SHA-256.
- **Signature en ligne** : l'ami reçoit un lien `/?pret=<id>`, se connecte avec l'adresse indiquée par le prêteur, écrit lui-même la somme en lettres (art. 1376 C. civ., vérifiée automatiquement) et signe.
- **Intérêts au choix** : 0 % par défaut, taux conventionnel plafonné ; intérêts de retard au taux légal, aucun, ou taux fixé (plafonné).
- **Échéancier** en une fois ou en mensualités, paiements partiels déclarés par l'emprunteur et confirmés par le prêteur (quittance).
- **Alerte 2062** au-delà de 5 000 € prêtés à une même personne dans l'année, et récapitulatif des intérêts perçus.
- **Garde-fou monopole bancaire** (art. L511-5 CMF) : attestation de prêt occasionnel et alerte si les prêts se multiplient.

## Mise en service

### 1. Publier les règles de sécurité Firestore (indispensable)

Sans ces règles, la base est ouverte : n'importe qui peut lire identités, adresses et IBAN.

Console Firebase → **Firestore Database** → onglet **Règles** → coller le contenu de [`firestore.rules`](firestore.rules) → **Publier**.

(Ou, avec la CLI : `firebase deploy --only firestore:rules`.)

### 2. Authentification Firebase

- **Authentication → Sign-in method** : activer *Google* et *Adresse e-mail/Mot de passe*.
- **Authentication → Paramètres → Domaines autorisés** : ajouter votre domaine Vercel (et, pour tester les aperçus, le domaine de l'aperçu Vercel).
- Les comptes email doivent **vérifier leur adresse** avant d'accéder aux prêts : c'est ce qui garantit que seul l'ami destinataire peut signer.

### 3. Variables d'environnement (Vercel)

| Variable | Rôle |
|---|---|
| `VITE_LENDER_EMAILS` | Optionnel. Adresses autorisées à **créer** des prêts, séparées par des virgules (ex. la vôtre). Les autres comptes ne peuvent qu'emprunter et signer. |

### 4. Paramètres à mettre à jour

`config/legal.ts` contient le plafond de taux (seuil de l'usure, trimestriel) et le taux de l'intérêt légal (semestriel).

## Développement

```bash
npm install
npm run dev
npm run build
```

## Avertissement

Les modèles et calculs sont une aide et ne constituent pas un conseil juridique ou fiscal.
Pour un montant important, faites relire le contrat par un professionnel ou passez par un acte notarié.
