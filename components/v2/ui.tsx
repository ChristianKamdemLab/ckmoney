import React, { useEffect } from 'react';

// Briques d'interface CKMoney v2 (charte CKLabs) : sobres, mobiles d'abord.
// Encre #1C2551, ocre #C98A1E, fond #F7F6F2, filets #EFEBE3, gris #6B6F80.

export const C = {
  ink: '#1C2551', ochre: '#C98A1E', ochreText: '#6E4A0D', ochreSoft: '#F6EBD6', bg: '#F7F6F2', card: '#FFFFFF',
  line: '#EFEBE3', border: '#E4E0D6', mute: '#6B6F80', text2: '#3A3E52', green: '#1F7A55', greenSoft: '#E3F1EA',
  red: '#B42318', redSoft: '#FCE4E1', soft: '#EEF0F6',
};

export const Screen: React.FC<{ children: React.ReactNode; bottomPad?: boolean }> = ({ children, bottomPad }) => (
  <div className="min-h-[100dvh] w-full flex justify-center" style={{ background: C.bg, color: C.ink }}>
    <div className={`w-full max-w-[480px] flex flex-col min-h-[100dvh] ${bottomPad ? 'pb-24' : ''}`}>{children}</div>
  </div>
);

export const TopBar: React.FC<{ onBack?: () => void; title?: string; right?: React.ReactNode; progress?: [number, number] }> = ({ onBack, title, right, progress }) => (
  <div className="flex items-center gap-1 px-3 pt-[max(env(safe-area-inset-top),16px)] min-h-[60px]">
    {onBack ? (
      <button onClick={onBack} aria-label="Retour" className="w-11 h-11 flex items-center justify-center rounded-full active:bg-black/5">
        <Icon name="back" />
      </button>
    ) : <div className="w-11" />}
    {progress ? (
      <div className="flex-1 flex gap-1.5 pr-14">
        {Array.from({ length: progress[1] }, (_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i < progress[0] ? C.ink : C.border }} />
        ))}
      </div>
    ) : (
      <div className="flex-1 text-center text-[15px] font-semibold">{title}</div>
    )}
    {progress ? null : <div className="w-11 flex justify-end">{right}</div>}
  </div>
);

export const H1: React.FC<{ children: React.ReactNode; sub?: React.ReactNode; desc?: React.ReactNode }> = ({ children, sub, desc }) => (
  <div className="px-6 pt-6">
    {sub && <div className="text-sm" style={{ color: C.mute }}>{sub}</div>}
    <h1 className="text-[26px] font-bold tracking-tight leading-tight mt-1">{children}</h1>
    {desc && <p className="text-[15px] leading-relaxed mt-1.5" style={{ color: C.mute }}>{desc}</p>}
  </div>
);

export const Amount: React.FC<{ children: React.ReactNode; size?: number; color?: string }> = ({ children, size = 52, color }) => (
  <div className="serif font-semibold leading-[1.1]" style={{ fontSize: size, letterSpacing: size > 40 ? -1 : -0.5, color: color || C.ink }}>{children}</div>
);

export const Button: React.FC<{
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'whatsapp' | 'danger' | 'ghost';
  disabled?: boolean; busy?: boolean; type?: 'button' | 'submit'; className?: string;
}> = ({ children, onClick, variant = 'primary', disabled, busy, type = 'button', className = '' }) => {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: C.ink, color: '#fff' },
    secondary: { background: C.card, color: C.ink },
    whatsapp: { background: C.green, color: '#fff' },
    danger: { background: C.card, color: C.red },
    ghost: { background: 'transparent', color: C.text2 },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy}
      className={`w-full h-14 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition active:scale-[0.99] disabled:opacity-40 ${className}`}
      style={styles[variant]}>
      {busy ? <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`rounded-2xl ${className}`} style={{ background: C.card, ...style }}>{children}</div>
);

export const KV: React.FC<{ rows: [React.ReactNode, React.ReactNode][] }> = ({ rows }) => (
  <Card className="px-4 py-1">
    {rows.map(([k, v], i) => (
      <div key={i} className="flex justify-between gap-4 py-3.5 text-[15px]" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
        <div style={{ color: C.mute }}>{k}</div>
        <div className="font-semibold text-right">{v}</div>
      </div>
    ))}
  </Card>
);

export const Avatar: React.FC<{ name: string; size?: number; tone?: number }> = ({ name, size = 40, tone }) => {
  const tones = [[C.ochreSoft, C.ochreText], [C.soft, C.ink], [C.greenSoft, '#145A3E'], [C.redSoft, '#8C1D18']];
  const t = tones[(tone ?? (name.charCodeAt(0) || 0)) % tones.length];
  return (
    <div className="rounded-full flex items-center justify-center font-bold shrink-0" style={{ width: size, height: size, background: t[0], color: t[1], fontSize: size * 0.38 }}>
      {(name || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
};

export const Chips: React.FC<{ options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }> = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(o => {
      const on = o.id === value;
      return (
        <button key={o.id} onClick={() => onChange(o.id)} className="h-11 px-[18px] rounded-full text-[15px] font-semibold"
          style={{ border: `1.5px solid ${on ? C.ink : C.border}`, background: on ? C.ink : C.card, color: on ? '#fff' : C.ink }}>
          {o.label}
        </button>
      );
    })}
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: React.ReactNode; htmlFor?: string }> = ({ label, children, hint, htmlFor }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={htmlFor} className="text-[13px] font-semibold" style={{ color: C.text2 }}>{label}</label>
    {children}
    {hint && <div className="text-[13px]" style={{ color: C.mute }}>{hint}</div>}
  </div>
);

export const inputClass = 'h-[52px] w-full rounded-[14px] bg-white px-4 text-base outline-none border-[1.5px] focus:border-[#1C2551]';
export const inputStyle: React.CSSProperties = { borderColor: C.border, color: C.ink };

export const Note: React.FC<{ children: React.ReactNode; tone?: 'info' | 'ok' | 'warn' | 'danger'; icon?: IconName }> = ({ children, tone = 'info', icon }) => {
  const t = { info: [C.soft, C.text2, C.ink], ok: [C.greenSoft, '#145A3E', C.green], warn: [C.ochreSoft, C.ochreText, C.ochreText], danger: [C.redSoft, '#8C1D18', C.red] }[tone];
  return (
    <div className="flex gap-2.5 px-3.5 py-3 rounded-[14px] text-[13px] leading-[1.45]" style={{ background: t[0], color: t[1] }}>
      <span className="shrink-0 mt-px" style={{ color: t[2] }}><Icon name={icon || (tone === 'ok' ? 'check' : 'info')} size={18} /></span>
      <div>{children}</div>
    </div>
  );
};

export const Footer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-auto px-5 pt-4 pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col gap-2.5">{children}</div>
);

/** Panneau qui glisse du bas de l'écran. */
export const Sheet: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Fermer" className="absolute inset-0 bg-[#1C2551]/40" onClick={onClose} />
      <div className="relative w-full max-w-[480px] rounded-t-[24px] px-5 pt-3 pb-[max(env(safe-area-inset-bottom),24px)] max-h-[90dvh] overflow-y-auto animate-[sheetIn_.22s_ease-out]" style={{ background: C.bg }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
        <div className="text-[19px] font-bold mb-4">{title}</div>
        {children}
      </div>
    </div>
  );
};

/** Message bref en bas de l'écran (remplace les alert() du navigateur). */
export const Toast: React.FC<{ text: string | null; onDone: () => void }> = ({ text, onDone }) => {
  useEffect(() => { if (!text) return; const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [text]);
  if (!text) return null;
  return (
    <div className="fixed left-0 right-0 bottom-24 z-[90] flex justify-center px-4 pointer-events-none">
      <div role="status" className="px-4 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg" style={{ background: C.ink }}>{text}</div>
    </div>
  );
};

export const Skeleton: React.FC<{ h?: number; className?: string }> = ({ h = 64, className = '' }) => (
  <div className={`rounded-2xl animate-pulse ${className}`} style={{ height: h, background: '#ECE8DF' }} />
);

/** Bouton « glisser pour signer » : on fait glisser la pastille jusqu'au bout. */
export const SlideToConfirm: React.FC<{ label: string; onConfirm: () => void; disabled?: boolean; busy?: boolean }> = ({ label, onConfirm, disabled, busy }) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [x, setX] = React.useState(0);
  const [drag, setDrag] = React.useState<number | null>(null);
  const max = () => (trackRef.current ? trackRef.current.offsetWidth - 60 : 240);
  const end = () => {
    if (drag === null) return;
    setDrag(null);
    if (x > max() * 0.85) { setX(max()); onConfirm(); } else setX(0);
  };
  useEffect(() => { if (!busy) setX(0); }, [busy]);
  return (
    <div ref={trackRef} className={`relative h-[60px] rounded-full select-none touch-none ${disabled ? 'opacity-40' : ''}`} style={{ background: C.ink }}
      onPointerMove={e => { if (drag === null) return; setX(Math.max(0, Math.min(max(), e.clientX - drag))); }}
      onPointerUp={end} onPointerLeave={end}>
      <div className="absolute inset-0 flex items-center justify-center text-white font-bold pl-12">{busy ? 'Signature…' : label}</div>
      <button aria-label={label} disabled={disabled || busy}
        onPointerDown={e => { if (disabled || busy) return; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(e.clientX - x); }}
        onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) onConfirm(); }}
        className="absolute top-1.5 left-1.5 w-12 h-12 rounded-full flex items-center justify-center"
        style={{ transform: `translateX(${x}px)`, background: C.ochre, color: C.ink, transition: drag === null ? 'transform .2s' : undefined }}>
        <Icon name="arrow" />
      </button>
    </div>
  );
};

export type IconName = 'back' | 'close' | 'plus' | 'check' | 'refresh' | 'bell' | 'home' | 'list' | 'activity' | 'user' | 'search'
  | 'chevron' | 'file' | 'chat' | 'dots' | 'info' | 'lock' | 'arrow' | 'phone' | 'calendar' | 'clock' | 'alert' | 'copy' | 'logout';

export const Icon: React.FC<{ name: IconName; size?: number }> = ({ name, size = 22 }) => {
  const p: Record<IconName, React.ReactNode> = {
    back: <path d="M15 18l-6-6 6-6" />, close: <path d="M18 6 6 18M6 6l12 12" />, plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M20 6 9 17l-5-5" />, refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
    bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />, activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>, search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    chevron: <path d="m9 6 6 6-6 6" />, file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></>,
    chat: <path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z" />, dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></>, lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />, phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>, clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" /></>,
    copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'dots' ? 3 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name]}</svg>
  );
};

/** Barre d'onglets du prêteur. */
export const TabBar: React.FC<{ tab: string; onTab: (t: 'home' | 'loans' | 'activity' | 'profile') => void; onCreate: () => void; badge?: number }> = ({ tab, onTab, onCreate, badge }) => {
  const item = (id: 'home' | 'loans' | 'activity' | 'profile', label: string, icon: IconName) => (
    <button onClick={() => onTab(id)} className="relative flex flex-col items-center gap-1 py-1.5 text-[11px]" style={{ color: tab === id ? C.ink : C.mute, fontWeight: tab === id ? 700 : 600 }}
      aria-current={tab === id ? 'page' : undefined}>
      <Icon name={icon} />
      {label}
      {id === 'activity' && !!badge && <span className="absolute top-0 right-[30%] w-2 h-2 rounded-full" style={{ background: C.red }} />}
    </button>
  );
  return (
    <nav aria-label="Navigation principale" className="fixed bottom-0 left-0 right-0 z-40 flex justify-center no-print" style={{ background: C.card, borderTop: `1px solid ${C.line}` }}>
      <div className="w-full max-w-[480px] grid grid-cols-5 items-center px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        {item('home', 'Accueil', 'home')}
        {item('loans', 'Prêts', 'list')}
        <button onClick={onCreate} aria-label="Nouveau prêt" className="justify-self-center w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ background: C.ochre, color: C.ink }}>
          <Icon name="plus" size={24} />
        </button>
        {item('activity', 'Activité', 'activity')}
        {item('profile', 'Profil', 'user')}
      </div>
    </nav>
  );
};

export const euro = (n: number, currency = 'EUR') =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${currency === 'EUR' ? '€' : currency}`;
export const euro2 = (n: number, currency = 'EUR') =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency === 'EUR' ? '€' : currency}`;
export const firstName = (s: string) => (s || '').trim().split(/\s+/)[0] || s;
export const dateFr = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', opts);
};
export const daysFromNow = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - t.getTime()) / 86_400_000);
};
export const relDays = (iso: string) => {
  const n = daysFromNow(iso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n > 1) return `dans ${n} jours`;
  return n === -1 ? 'hier' : `il y a ${-n} jours`;
};
