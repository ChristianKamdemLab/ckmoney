import { describe, it, expect, vi } from 'vitest';
vi.mock('../services/firebase', () => ({ db: {}, auth: {} }));
import { payProvider } from '../services/loanService';

describe('libellé du lien de paiement', () => {
  it('reconnaît le service par le nom d’hôte', () => {
    expect(payProvider('https://paypal.me/ami')).toBe('PayPal');
    expect(payProvider('paypal.me/ami')).toBe('PayPal');
    expect(payProvider('https://www.paypal.com/paypalme/ami')).toBe('PayPal');
    expect(payProvider('https://revolut.me/ami')).toBe('Revolut');
    expect(payProvider('https://lydia-app.com/collect/x')).toBe('Lydia');
  });
  it('n’affiche pas un service connu pour un autre site', () => {
    expect(payProvider('https://exemple.test/paypal')).toBe('le lien de paiement (exemple.test)');
    expect(payProvider('https://paypal.me.exemple.test/x')).toBe('le lien de paiement (paypal.me.exemple.test)');
    expect(payProvider('https://faux-paypal.com/x')).toBe('le lien de paiement (faux-paypal.com)');
  });
  it('reste vide sans lien', () => { expect(payProvider(undefined)).toBe(''); });
});
