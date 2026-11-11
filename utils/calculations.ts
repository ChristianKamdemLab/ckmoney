// Utilitaires d'affichage. Les calculs financiers sont dans utils/schedule.ts.

export const formatDate = (dateStr: string) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(Number(dateStr.slice(0, 4)), Number(dateStr.slice(5, 7)) - 1, Number(dateStr.slice(8, 10)))
    : new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};
