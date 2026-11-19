/** En français, le premier jour du mois s'écrit « 1er » : « 1er août », pas « 1 août ».
 *  S'applique à une date déjà mise en forme par toLocaleDateString('fr-FR', …),
 *  avec ou sans jour de la semaine, mois long ou abrégé. Les dates en chiffres (01/08/2026) ne changent pas. */
export const avecPremier = (date: string) => date.replace(/(^|\s)1 (?=\p{Ll})/gu, '$11er ');
