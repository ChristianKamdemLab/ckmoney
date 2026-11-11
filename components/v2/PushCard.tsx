import React, { useEffect, useState } from 'react';
import { Icon, C } from './ui';
import { enablePush, pushPermission, pushSupported } from '../../services/push';

/** Proposition d'activer les notifications (rappels, demandes, paiements). Masquée une fois réglée. */
const PushCard: React.FC<{ uid: string; text: string }> = ({ uid, text }) => {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | 'ok' | 'no'>(null);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem('ck_push_later') === new Date().toISOString().slice(0, 10); } catch { /* ignore */ }
    pushSupported().then(ok => setShow(ok && pushPermission() === 'default' && !dismissed));
  }, []);
  if (!show && !done) return null;
  if (done === 'ok') return (
    <div className="rounded-2xl px-4 py-3 text-sm font-semibold" style={{ background: C.greenSoft, color: C.green }}>Notifications activées.</div>
  );
  if (done === 'no') return (
    <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: C.soft, color: C.text2 }}>Notifications refusées. Tu pourras les activer plus tard dans les réglages de ton navigateur.</div>
  );
  return (
    <div className="rounded-2xl p-4 flex gap-3 items-start" style={{ background: C.ochreSoft }}>
      <span className="mt-0.5" style={{ color: C.ochreText }}><Icon name="bell" size={22} /></span>
      <div className="flex-1">
        <div className="text-[15px] font-semibold">Activer les notifications</div>
        <div className="text-[13px] mt-0.5 leading-snug" style={{ color: C.text2 }}>{text}</div>
        <div className="flex gap-2 mt-3">
          <button disabled={busy} onClick={async () => { setBusy(true); const ok = await enablePush(uid); setBusy(false); setShow(false); setDone(ok ? 'ok' : 'no'); }}
            className="h-10 px-4 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: C.ink }}>{busy ? 'Activation…' : 'Activer'}</button>
          <button onClick={() => { try { localStorage.setItem('ck_push_later', new Date().toISOString().slice(0, 10)); } catch { /* ignore */ } setShow(false); }}
            className="h-10 px-3 rounded-xl text-sm font-semibold" style={{ color: C.text2 }}>Plus tard</button>
        </div>
      </div>
    </div>
  );
};

export default PushCard;
