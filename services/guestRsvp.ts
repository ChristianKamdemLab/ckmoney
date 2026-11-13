// Réponse à un chill depuis la page publique, sans compte : un prénom et un jeton gardés par le
// navigateur, pour pouvoir annuler plus tard depuis le même téléphone.

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* navigation privée */ } };

export const guestName = () => get('ck_guest_name') || '';
const token = () => {
  let t = get('ck_guest_token');
  if (!t) {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    t = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
    set('ck_guest_token', t);
  }
  return t;
};

export const guestGoing = (id: string) => get(`ck_rsvp_${id}`) === '1';

export const guestRsvp = async (id: string, going: boolean, name: string): Promise<{ going: boolean; placesLeft: number | null }> => {
  const r = await fetch('/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'rsvp', id, going, name, token: token() }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `http_${r.status}`);
  set('ck_guest_name', name);
  set(`ck_rsvp_${id}`, going ? '1' : null);
  return data;
};
