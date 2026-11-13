import crypto from 'node:crypto';

// Lecture du dossier Drive « CKMoney – Articles à publier » avec le compte technique de CKMoney
// (la clé de service Firebase, déjà sur Vercel). Le dossier doit être partagé en lecture avec
// ce compte, et l'API Google Drive activée sur le projet. Lecture seule.

export const ARTICLES_FOLDER_ID = '11dNakz1LBWisZdH9y5Wx55lhpMS9ECGa';

export interface DriveFile { id: string; name: string; mimeType: string; modifiedTime: string; size?: string }

let cached: { token: string; exp: number } | null = null;

const token = async () => {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const { client_email, private_key } = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!client_email || !private_key) throw new Error('drive_cle');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: client_email, scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`drive_jeton ${j.error || r.status}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
};

const api = async (path: string) => {
  const r = await fetch(`https://www.googleapis.com/drive/v3/${path}`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!r.ok) {
    const j: any = await r.json().catch(() => ({}));
    throw new Error(`drive ${r.status} ${j?.error?.errors?.[0]?.reason || j?.error?.message || ''}`.trim());
  }
  return r;
};

export const listFolder = async (folderId = ARTICLES_FOLDER_ID): Promise<DriveFile[]> => {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const r = await api(`files?q=${q}&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=modifiedTime&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return ((await r.json()) as any).files || [];
};

/** Contenu d'un fichier : octets (PDF, Word) ou texte (Google Doc exporté). */
export const downloadFile = async (f: DriveFile): Promise<{ data?: Uint8Array; text?: string }> => {
  if (f.mimeType === 'application/vnd.google-apps.document') {
    return { text: await (await api(`files/${f.id}/export?mimeType=text/plain`)).text() };
  }
  return { data: new Uint8Array(await (await api(`files/${f.id}?alt=media&supportsAllDrives=true`)).arrayBuffer()) };
};
