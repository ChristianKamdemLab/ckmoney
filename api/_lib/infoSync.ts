import { adminDb } from './admin.js';
import type { DriveFile } from './drive.js';
import { infoDate, parseInfo } from '../../utils/infoDuJour.js';

// Publie « L'info du jour » à partir des documents « Info du jour · AAAA-MM-JJ » du dossier Drive.
// Relu seulement quand le document a changé ; les 3 plus récents au plus.

export const isInfoDoc = (f: DriveFile) => !!infoDate(f.name) && f.mimeType !== 'application/pdf';

export const syncInfo = async (files: DriveFile[], download: (f: DriveFile) => Promise<{ data?: Uint8Array; text?: string }>) => {
  const docs = files.filter(isInfoDoc).sort((a, b) => infoDate(b.name)!.localeCompare(infoDate(a.name)!) || b.modifiedTime.localeCompare(a.modifiedTime));
  const seen = new Set<string>();
  const out: Record<string, number> = {};
  for (const f of docs) {
    const date = infoDate(f.name)!;
    if (seen.has(date) || seen.size >= 3) continue;
    seen.add(date);
    const ref = adminDb.collection('daily').doc(date);
    if ((await ref.get()).data()?.docModified === f.modifiedTime) continue;
    const c = await download(f);
    const items = parseInfo(c.text ?? new TextDecoder().decode(c.data!));
    await ref.set({ date, items, docModified: f.modifiedTime, updatedAt: new Date().toISOString() });
    out[date] = items.length;
  }
  return out;
};
