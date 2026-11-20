import { describe, it, expect, vi, beforeEach } from 'vitest';
import { puzzleFor, START } from '../games/mot';

const store: Record<string, any> = {};
const pushed: string[] = [];
const tokens = [{ id: 'a', data: () => ({ tokens: ['t'] }) }, { id: 'b', data: () => ({ tokens: ['t'], motOff: true }) }, { id: 'c', data: () => ({ tokens: ['t'] }) }];
vi.mock('../api/_lib/admin.js', () => ({
  adminDb: {
    collection: (c: string) => c === 'pushTokens'
      ? { get: async () => ({ docs: tokens }) }
      : { doc: (id: string) => ({ id: `${c}/${id}` }) },
    runTransaction: async (fn: any) => fn({ get: async (r: any) => ({ data: () => store[r.id] }), set: (r: any, v: any) => { store[r.id] = { ...store[r.id], ...v }; } }),
  },
  pushToUser: async (uid: string) => { pushed.push(uid); return 1; },
}));

const { sendDailyMot, motMessage } = await import('../api/_lib/motPush');

describe('Notification du mot du jour', () => {
  beforeEach(() => { pushed.length = 0; Object.keys(store).forEach(k => delete store[k]); });

  it('annonce le mot sans le dévoiler', () => {
    for (const n of [1, 2, 3, 4]) {
      const m = motMessage(n);
      expect(m.title).toBe(`Le mot du jour n° ${n}`);
      expect(m.url).toBe('/?mot');
      expect(m.body.toUpperCase()).not.toContain(puzzleFor(n).word);
    }
    expect(motMessage(1).body).toContain('mot du 237');
  });

  it('une fois par jour, pas à ceux qui ont coupé le rappel', async () => {
    const at9 = START + 8 * 3_600_000; // 9 h à Paris le jour n° 1
    expect(await sendDailyMot(at9)).toEqual({ n: 1, sent: 2 });
    expect(pushed).toEqual(['a', 'c']);
    expect(await sendDailyMot(at9 + 60_000)).toEqual({ n: 1, sent: 0 });
    expect((await sendDailyMot(at9 + 86_400_000)).sent).toBe(2);
  });
});
