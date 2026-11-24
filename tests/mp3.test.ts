import { describe, it, expect } from 'vitest';
import { joinMp3, frameLength } from '../api/_lib/mp3';

// Trames MP3 inventées (MPEG-1 Layer III, 64 kb/s, 44,1 kHz, mono) : 208 octets chacune
const frame = (fill: number, info = '') => {
  const b = Buffer.alloc(208, fill);
  Buffer.from([0xff, 0xfb, 0x50, 0xc4]).copy(b, 0);
  if (info) b.write(info, 4 + 17, 'latin1');
  return b;
};
const part = (n: number, fill: number) => Buffer.concat([frame(0, 'Xing'), ...Array.from({ length: n }, () => frame(fill))]);

describe('MP3 recollés', () => {
  it('lit la longueur d’une trame', () => expect(frameLength(frame(1), 0)).toBe(208));
  it('retire les trames d’information des morceaux et annonce la vraie durée en tête', () => {
    const out = joinMp3([part(5, 1), part(10, 2), part(3, 3)]);
    expect(out.length).toBe(208 * (1 + 18));
    expect(out.toString('latin1').match(/Xing/g)).toHaveLength(1);
    expect(out.readUInt32BE(4 + 17 + 8)).toBe(18);         // nombre de trames audio
    expect(out.readUInt32BE(4 + 17 + 12)).toBe(out.length); // octets
  });
});
