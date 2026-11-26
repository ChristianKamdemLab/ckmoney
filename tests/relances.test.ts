import { describe, it, expect, vi } from 'vitest';
vi.mock('../api/_lib/admin', () => ({ adminDb: {}, pushToUser: vi.fn(), verifiedEmail: vi.fn(), lenderMailAllowed: vi.fn() }));
vi.mock('../api/_lib/mail', () => ({ sendReminderMail: vi.fn() }));
import { overdueSlot } from '../api/_lib/reminders';

// 26/11 : heure de Paris = UTC + 1
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 26, h - 1, m));
describe('relances de retard : quatre créneaux par jour', () => {
  it('8 h, 12 h, 16 h, 19 h', () => {
    expect(overdueSlot(at(8, 5))?.endsWith('-0')).toBe(true);
    expect(overdueSlot(at(13))?.endsWith('-1')).toBe(true);
    expect(overdueSlot(at(17, 30))?.endsWith('-2')).toBe(true);
    expect(overdueSlot(at(19, 40))?.endsWith('-3')).toBe(true);
  });
  it('jamais la nuit', () => {
    expect(overdueSlot(at(7, 59))).toBeNull();
    expect(overdueSlot(at(21, 5))).toBeNull();
    expect(overdueSlot(at(23))).toBeNull();
  });
});
