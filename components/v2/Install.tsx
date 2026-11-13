import React, { useEffect, useState } from 'react';
import { Sheet, Button, Note, C } from './ui';
import {
  isStandalone, detectedPhone, iosBrowser, androidBrowser, canPromptInstall, promptInstall, onInstallChange,
  wasInstalled, safariLink, chromeIntent, appUrl,
} from '../../services/install';

// Installer CKMoney sur le téléphone : on demande iPhone ou Android, puis on guide pas à pas.
// Android + Chrome : la fenêtre d'installation s'ouvre directement. iPhone : par le menu de Safari
// (Apple ne permet à aucun site de s'installer tout seul).

const Svg: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ShareIcon = () => <Svg><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></Svg>;
const DotsH = () => <Svg><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></Svg>;
const DotsV = () => <Svg><circle cx="12" cy="5" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="19" r="1.3" fill="currentColor" /></Svg>;
const PlusSquare = () => <Svg><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></Svg>;
const Toggle = () => <span className="inline-block w-8 h-[18px] rounded-full relative align-middle" style={{ background: '#34C759' }}><span className="absolute top-[2px] right-[2px] w-[14px] h-[14px] rounded-full bg-white" /></span>;
const Bell = () => <Svg><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Svg>;
const PhoneIcon: React.FC<{ size?: number }> = ({ size = 28 }) => <Svg size={size}><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></Svg>;

const Step: React.FC<{ n: number; icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode }> = ({ n, icon, title, sub }) => (
  <div className="flex gap-3 items-start">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 relative" style={{ background: C.card, color: C.ink, border: `1.5px solid ${C.border}` }}>
      {icon}
      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center" style={{ background: C.ochre, color: C.ink }}>{n}</span>
    </div>
    <div className="flex-1 pt-0.5">
      <div className="text-[15px] font-semibold leading-snug" style={{ color: C.ink }}>{title}</div>
      {sub && <div className="text-[13px] mt-0.5 leading-snug" style={{ color: C.mute }}>{sub}</div>}
    </div>
  </div>
);

const CopyLink: React.FC<{ label?: string }> = ({ label = 'Copier le lien' }) => {
  const [done, setDone] = useState(false);
  return <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(appUrl()).then(() => setDone(true)).catch(() => undefined); }}>{done ? 'Lien copié' : label}</Button>;
};

const IPhoneGuide: React.FC = () => {
  const browser = iosBrowser();
  return (
    <div className="flex flex-col gap-4">
      {browser !== 'safari' && (
        <>
          <Note tone="warn">Sur iPhone, l'installation se fait depuis <b>Safari</b> (la boussole bleue). {browser === 'chrome' ? 'Tu es dans Chrome.' : 'Tu es dans une autre appli.'}</Note>
          <a href={safariLink()} className="h-14 rounded-2xl flex items-center justify-center text-base font-bold text-white" style={{ background: C.ink }}>Ouvrir dans Safari</a>
          <CopyLink label="Copier le lien (à coller dans Safari)" />
          <div className="text-[13px] font-semibold pt-1" style={{ color: C.text2 }}>Ensuite, dans Safari :</div>
        </>
      )}
      <Step n={1} icon={<DotsH />} title={<>Touche <b>•••</b> à droite de la barre d'adresse</>}
        sub={<>Sur un iPhone plus ancien : le bouton Partager <span className="inline-block align-middle"><ShareIcon /></span> en bas de l'écran.</>} />
      <Step n={2} icon={<ShareIcon />} title={<>Touche <b>Partager</b>, puis <b>Sur l'écran d'accueil</b></>} sub="Fais défiler la liste vers le bas si tu ne le vois pas." />
      <Step n={3} icon={<PlusSquare />} title={<>Laisse <b>Ouvrir comme app web</b> <Toggle /> activé, puis touche <b>Ajouter</b></>} />
      <Step n={4} icon={<Bell />} title="Ouvre CKMoney depuis la nouvelle icône" sub="Puis touche « Activer » pour recevoir les rappels : sur iPhone, les notifications ne marchent que dans l'appli installée." />
    </div>
  );
};

const AndroidGuide: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const browser = androidBrowser();
  const [can, setCan] = useState(canPromptInstall());
  const [busy, setBusy] = useState(false);
  useEffect(() => onInstallChange(() => setCan(canPromptInstall())), []);
  if (can) return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-relaxed" style={{ color: C.text2 }}>Un geste suffit : Chrome te demande de confirmer, et l'icône CKMoney apparaît sur ton écran d'accueil.</p>
      <Button busy={busy} onClick={async () => { setBusy(true); const ok = await promptInstall(); setBusy(false); if (ok) onDone(); }}>Installer maintenant</Button>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      {browser !== 'chrome' && (
        <>
          <Note tone="warn">L'installation est la plus simple dans <b>Chrome</b>.{browser === 'samsung' ? ' Tu es dans Samsung Internet.' : ''}</Note>
          <a href={chromeIntent()} className="h-14 rounded-2xl flex items-center justify-center text-base font-bold text-white" style={{ background: C.ink }}>Ouvrir dans Chrome</a>
          <CopyLink />
          {browser === 'samsung' && <Note>Dans Samsung Internet : menu <b>≡</b> en bas, puis <b>Ajouter la page à</b> et <b>Écran d'accueil</b>.</Note>}
          <div className="text-[13px] font-semibold pt-1" style={{ color: C.text2 }}>Ensuite, dans Chrome :</div>
        </>
      )}
      <Step n={1} icon={<DotsV />} title={<>Touche <b>⋮</b> en haut à droite de Chrome</>} />
      <Step n={2} icon={<PlusSquare />} title={<>Choisis <b>Installer l'application</b></>} sub="Sur certains téléphones : « Ajouter à l'écran d'accueil »." />
      <Step n={3} icon={<Bell />} title={<>Confirme avec <b>Installer</b>, puis ouvre CKMoney depuis l'icône</>} sub="Touche « Activer » pour recevoir les rappels en notification." />
    </div>
  );
};

/** Ouverture depuis un lien (/?installer, par exemple dans l'e-mail des nouveautés). */
export const InstallFromLink: React.FC = () => {
  const [open, setOpen] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (!sp.has('installer')) return false;
      sp.delete('installer');
      window.history.replaceState({}, '', `${window.location.pathname}${sp.toString() ? `?${sp}` : ''}`);
      return !isStandalone();
    } catch { return false; }
  });
  return <InstallSheet open={open} onClose={() => setOpen(false)} />;
};

export const InstallSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [phone, setPhone] = useState<'iphone' | 'android' | null>(null);
  const [done, setDone] = useState(false);
  const detected = detectedPhone();
  useEffect(() => { if (!open) { setPhone(null); setDone(false); } }, [open]);
  const title = done ? "C'est installé" : phone === 'iphone' ? 'Installer sur iPhone' : phone === 'android' ? 'Installer sur Android' : 'Installer CKMoney';
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {done ? (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] leading-relaxed" style={{ color: C.text2 }}>L'icône CKMoney est sur ton écran d'accueil. Ouvre l'appli depuis cette icône à partir de maintenant.</p>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      ) : !phone ? (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] leading-relaxed" style={{ color: C.text2 }}>C'est gratuit et rapide : pas besoin de l'App Store ni du Play Store, l'appli s'ajoute directement à ton écran d'accueil. Quel téléphone as-tu ?</p>
          {(['iphone', 'android'] as const).map(p => (
            <button key={p} onClick={() => setPhone(p)} className="h-16 rounded-2xl flex items-center gap-3 px-4 text-left"
              style={{ background: C.card, border: `1.5px solid ${detected === p ? C.ink : C.border}`, color: C.ink }}>
              <PhoneIcon />
              <span className="flex-1">
                <span className="text-[16px] font-bold block">{p === 'iphone' ? 'iPhone' : 'Android'}</span>
                <span className="text-[12px]" style={{ color: C.mute }}>{p === 'iphone' ? 'avec Safari' : 'Samsung, Xiaomi, Tecno, Pixel… avec Chrome'}</span>
              </span>
              {detected === p && <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: C.ochreSoft, color: C.ochreText }}>ton téléphone</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {phone === 'iphone' ? <IPhoneGuide /> : <AndroidGuide onDone={() => setDone(true)} />}
          <button onClick={() => setPhone(null)} className="text-[14px] font-semibold self-start" style={{ color: C.ochreText }}>Changer de téléphone</button>
        </div>
      )}
    </Sheet>
  );
};

/** Hook : faut-il proposer l'installation (pas déjà dans l'appli installée) ? */
export const useInstallable = () => {
  const [show, setShow] = useState(() => !isStandalone());
  useEffect(() => onInstallChange(() => { if (wasInstalled()) setShow(false); }), []);
  return show;
};

const KEY = 'ck_install_later';
/** Carte bien visible sur l'accueil, tant que l'appli n'est pas installée. « Plus tard » la cache 7 jours. */
export const InstallCard: React.FC = () => {
  const installable = useInstallable();
  const [open, setOpen] = useState(false);
  const [later, setLater] = useState(() => { try { return Date.now() < Number(localStorage.getItem(KEY) || 0); } catch { return false; } });
  if (!installable || later) return null;
  return (
    <div className="px-5 pt-4 no-print">
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.ink, color: '#fff' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-[14px] shrink-0" style={{ background: C.ochre, color: C.ink }}>CK</div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold leading-tight">Installe l'appli sur ton téléphone</div>
          <div className="text-[12.5px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,.7)' }}>Une icône sur ton écran d'accueil et les rappels en notification.</div>
          <button onClick={() => { setLater(true); try { localStorage.setItem(KEY, String(Date.now() + 7 * 86_400_000)); } catch { /* ignore */ } }}
            className="text-[12.5px] font-semibold mt-1.5" style={{ color: 'rgba(255,255,255,.6)' }}>Plus tard</button>
        </div>
        <button onClick={() => setOpen(true)} className="h-10 px-4 rounded-xl text-[14px] font-bold shrink-0" style={{ background: C.ochre, color: C.ink }}>Installer</button>
      </div>
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

/** Bouton discret (connexion, profil, menu) qui ouvre le même guide. */
export const InstallButton: React.FC<{ className?: string; label?: string; variant?: 'link' | 'row' }> = ({ className = '', label = "Installer l'appli sur mon téléphone", variant = 'link' }) => {
  const installable = useInstallable();
  const [open, setOpen] = useState(false);
  if (!installable) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={`${variant === 'link' ? 'h-12 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2' : ''} ${className}`}
        style={variant === 'link' ? { color: C.ink, background: 'transparent' } : undefined}>
        <PhoneIcon size={20} /> {label}
      </button>
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
};
