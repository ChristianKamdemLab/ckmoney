
export const fetchExchangeRate = async (amount: number, from: string): Promise<number> => {
  if (from === 'EUR') return amount;
  
  try {
    // API Frankfurter est gratuite et ne nécessite pas de clé pour les usages basiques
    const response = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=EUR`);
    if (!response.ok) throw new Error('Conversion failed');
    const data = await response.json();
    return data.rates.EUR;
  } catch (error) {
    console.error("Exchange rate error:", error);
    // Fallback à un taux fixe approximatif si l'API échoue
    const fallbacks: Record<string, number> = {
      'USD': 0.92,
      'XAF': 0.0015,
      'CAD': 0.68,
      'CHF': 1.04,
      'GBP': 1.17
    };
    return amount * (fallbacks[from] || 1);
  }
};
