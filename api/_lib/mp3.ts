// Mettre des MP3 bout à bout : chaque morceau (jingle, répliques) commence souvent par une balise ID3
// et une trame « Xing », « Info » ou « VBRI » qui annonce la durée du morceau. Laissée en tête du fichier
// final, elle fait croire au téléphone que tout l'audio dure… le premier morceau (le lecteur s'arrêtait
// après le jingle, 24/11). On les retire avant de recoller.

const BITRATES: Record<string, number[]> = {
  '1': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],   // MPEG-1 Layer III
  '2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],        // MPEG-2 / 2.5 Layer III
};
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Longueur de la trame qui commence à i (0 si ce n'est pas un en-tête MP3 valide). */
export const frameLength = (b: Buffer, i: number) => {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return 0;
  const version = (b[i + 1] >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
  const layer = (b[i + 1] >> 1) & 3;   // 1 = Layer III
  if (version === 1 || layer !== 1) return 0;
  const br = BITRATES[version === 3 ? '1' : '2'][(b[i + 2] >> 4) & 15];
  const sr = RATES[version]?.[(b[i + 2] >> 2) & 3];
  if (!br || !sr) return 0;
  const pad = (b[i + 2] >> 1) & 1;
  return Math.floor(((version === 3 ? 144 : 72) * br * 1000) / sr) + pad;
};

/** Retire la balise ID3v2 de tête et la trame d'information (Xing, Info, VBRI) d'un morceau. */
export const stripHeader = (mp3: Buffer): Buffer => {
  let i = 0;
  if (mp3.length > 10 && mp3.toString('latin1', 0, 3) === 'ID3') {
    const size = ((mp3[6] & 0x7f) << 21) | ((mp3[7] & 0x7f) << 14) | ((mp3[8] & 0x7f) << 7) | (mp3[9] & 0x7f);
    i = 10 + size + ((mp3[5] & 0x10) ? 10 : 0);
  }
  while (i < mp3.length - 4 && !frameLength(mp3, i)) i++; // première trame
  const len = frameLength(mp3, i);
  if (len) {
    const head = mp3.toString('latin1', i, Math.min(mp3.length, i + len));
    if (/Xing|Info|VBRI/.test(head)) i += len;
  }
  // Balise ID3v1 de fin (128 octets « TAG »)
  const end = mp3.length >= 128 && mp3.toString('latin1', mp3.length - 128, mp3.length - 125) === 'TAG' ? mp3.length - 128 : mp3.length;
  return mp3.subarray(i, end);
};

/** Une trame « Xing » au début du fichier recollé : nombre exact de trames et d'octets, pour que tous
 *  les lecteurs (iPhone compris) connaissent la vraie durée, même si le jingle et les voix n'ont pas le
 *  même débit. */
export const withXing = (stream: Buffer): Buffer => {
  let frames = 0;
  for (let i = 0; i < stream.length - 4;) { const len = frameLength(stream, i); if (!len) break; frames++; i += len; }
  const len = frameLength(stream, 0);
  if (!len || !frames) return stream;
  const head = Buffer.from(stream.subarray(0, 4));
  const mpeg1 = ((head[1] >> 3) & 3) === 3;
  const mono = ((head[3] >> 6) & 3) === 3;
  const side = mpeg1 ? (mono ? 17 : 32) : (mono ? 9 : 17);
  const frame = Buffer.alloc(len);
  head.copy(frame, 0);
  const o = 4 + side;
  if (o + 16 > len) return stream;
  frame.write('Xing', o, 'latin1');
  frame.writeUInt32BE(3, o + 4);                     // nombre de trames et d'octets présents
  frame.writeUInt32BE(frames, o + 8);
  frame.writeUInt32BE(stream.length + len, o + 12);
  return Buffer.concat([frame, stream]);
};

export const joinMp3 = (parts: Buffer[]) => withXing(cleanStream(Buffer.concat(parts.map(stripHeader))));

/** Nettoie un flux MP3 entier : garde les trames audio, retire partout les balises ID3 et les trames
 *  d'information (utile pour réparer un fichier déjà recollé). */
export const cleanStream = (b: Buffer): Buffer => {
  const out: Buffer[] = [];
  let i = 0;
  while (i < b.length - 4) {
    if (b.toString('latin1', i, i + 3) === 'ID3' && i + 10 <= b.length) {
      const size = ((b[i + 6] & 0x7f) << 21) | ((b[i + 7] & 0x7f) << 14) | ((b[i + 8] & 0x7f) << 7) | (b[i + 9] & 0x7f);
      i += 10 + size + ((b[i + 5] & 0x10) ? 10 : 0);
      continue;
    }
    const len = frameLength(b, i);
    if (!len || i + len > b.length) { i++; continue; }
    const head = b.toString('latin1', i + 4, Math.min(i + len, i + 48));
    if (!/Xing|Info|VBRI/.test(head)) out.push(b.subarray(i, i + len));
    i += len;
  }
  return Buffer.concat(out);
};
