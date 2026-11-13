// Rôles et envoi d'e-mails, sans dépendance (testable) :
//  - administrateur : les adresses de VITE_LENDER_EMAILS (Christian) — jamais l'adresse d'envoi de l'appli ;
//  - e-mails des rappels : depuis GMAIL_USER. Tant que c'est l'adresse personnelle de Christian, seuls ses
//    prêts en envoient ; dès que c'est l'adresse dédiée de l'appli (ckmoneyapp@gmail.com), tous les prêteurs.

const list = (v?: string) => String(v || '').split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean);

export const adminEmails = () => list(process.env.VITE_LENDER_EMAILS);
export const isAdminEmail = (email?: string, emailVerified = true) =>
  !!email && emailVerified && adminEmails().includes(email.toLowerCase());

/** Adresse d'envoi dédiée à l'appli (pas celle d'un administrateur) : les e-mails sont ouverts à tous les prêteurs. */
export const mailForAllLenders = () => {
  const sender = String(process.env.GMAIL_USER || '').trim().toLowerCase();
  return !!sender && adminEmails().length > 0 && !adminEmails().includes(sender);
};

/** Ce prêteur peut-il faire partir des e-mails (rappels) vers ses proches ? */
export const lenderMailAllowed = (lenderEmail?: string) => !!lenderEmail && (isAdminEmail(lenderEmail) || mailForAllLenders());
