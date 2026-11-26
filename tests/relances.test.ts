import { describe, it, expect, vi } from 'vitest';
vi.mock('../api/_lib/admin', () => ({ adminDb: {}, pushToUser: vi.fn(), verifiedEmail: vi.fn(), lenderMailAllowed: vi.fn() }));
vi.mock('../api/_lib/mail', () => ({ sendReminderMail: vi.fn() }));
import { overdueSlot } from '../api/_lib/reminders';

// 26/11 : heure de Paris = UTC + 1
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 26, h - 1, m));
describe('relances de retard : une par jour', () => {
  it('le même créneau toute la journée, de 8 h à 21 h', () => {
    expect(overdueSlot(at(8, 5))).toBe('2026-11-26-0');
    expect(overdueSlot(at(13))).toBe(overdueSlot(at(19, 40)));
  });
  it('jamais la nuit', () => {
    expect(overdueSlot(at(7, 59))).toBeNull();
    expect(overdueSlot(at(21, 5))).toBeNull();
    expect(overdueSlot(at(23))).toBeNull();
  });
});
