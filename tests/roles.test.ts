import { describe, it, expect, vi, afterEach } from 'vitest';
import { isAdminEmail, mailForAllLenders, lenderMailAllowed, adminEmails } from '../api/_lib/roles';

// Rôles et e-mails : Christian administrateur ; e-mails pour tous les prêteurs seulement depuis l'adresse de l'appli.

afterEach(() => vi.unstubAllEnvs());

describe('rôles', () => {
  it('administrateur : seulement les adresses de VITE_LENDER_EMAILS, jamais l’adresse d’envoi', () => {
    vi.stubEnv('VITE_LENDER_EMAILS', 'Christian@Example.com');
    vi.stubEnv('GMAIL_USER', 'ckmoneyapp@gmail.com');
    expect(adminEmails()).toEqual(['christian@example.com']);
    expect(isAdminEmail('christian@example.com')).toBe(true);
    expect(isAdminEmail('christian@example.com', false)).toBe(false);
    expect(isAdminEmail('ckmoneyapp@gmail.com')).toBe(false);
  });
  it('sans liste d’administrateurs : personne (pas de repli sur l’adresse d’envoi)', () => {
    vi.stubEnv('VITE_LENDER_EMAILS', '');
    vi.stubEnv('GMAIL_USER', 'christian@example.com');
    expect(isAdminEmail('christian@example.com')).toBe(false);
    expect(mailForAllLenders()).toBe(false);
  });
  it('e-mails depuis le Gmail de Christian : seulement ses prêts', () => {
    vi.stubEnv('VITE_LENDER_EMAILS', 'christian@example.com');
    vi.stubEnv('GMAIL_USER', 'christian@example.com');
    expect(mailForAllLenders()).toBe(false);
    expect(lenderMailAllowed('christian@example.com')).toBe(true);
    expect(lenderMailAllowed('ami@example.com')).toBe(false);
  });
  it('e-mails depuis l’adresse de l’appli : tous les prêteurs', () => {
    vi.stubEnv('VITE_LENDER_EMAILS', 'christian@example.com');
    vi.stubEnv('GMAIL_USER', 'ckmoneyapp@gmail.com');
    expect(mailForAllLenders()).toBe(true);
    expect(lenderMailAllowed('ami@example.com')).toBe(true);
    expect(lenderMailAllowed(undefined)).toBe(false);
  });
});
