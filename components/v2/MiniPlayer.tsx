import React from 'react';
import { C, Icon } from './ui';
import { player, usePlayer } from '../../services/player';

// Mini-lecteur (26/11) : visible dès qu'un son est lancé (le décryptage), au-dessus du menu du bas
// (ou en bas de l'écran quand il n'y a pas de menu). Toucher le titre rouvre l'écran d'origine.
const MiniPlayer: React.FC<{ withTabs: boolean }> = ({ withTabs }) => {
  const s = usePlayer();
  if (!s.track) return null;
  const pct = s.len ? Math.min(100, (s.t / s.len) * 100) : 0;
  return (
    <div className="fixed left-0 right-0 z-40 flex justify-center px-3 no-print pointer-events-none"
      style={{ bottom: withTabs ? 'calc(max(env(safe-area-inset-bottom), 12px) + 66px)' : 'max(env(safe-area-inset-bottom), 12px)' }}>
      <div className="pointer-events-auto relative w-full max-w-[456px] h-[60px] rounded-[18px] flex items-center gap-3 pl-3 pr-1.5 overflow-hidden"
        style={{ background: C.night, color: C.nightText, boxShadow: '0 8px 24px rgba(14,21,51,.28)' }}>
        <button onClick={s.track.open} disabled={!s.track.open} className="flex-1 min-w-0 flex items-center gap-3 text-left">
          <span className="w-[38px] h-[38px] rounded-[10px] shrink-0 flex items-center justify-center text-[11px] font-extrabold" style={{ background: C.mango, color: C.ink }}>CK</span>
          <span className="min-w-0 flex flex-col">
            <span className="text-[13.5px] font-extrabold truncate">{s.track.title}</span>
            <span className="text-[12px] truncate" style={{ color: C.nightMute }}>{s.error ? 'Audio indisponible, réessaie' : s.loading ? 'Chargement…' : s.track.sub}</span>
          </span>
        </button>
        <button onClick={player.toggle} disabled={s.loading} aria-label={s.playing ? 'Pause' : 'Lecture'} className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ color: C.mango }}>
          {s.loading ? <span className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,194,61,.3)', borderTopColor: C.mango }} />
            : s.playing ? <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" /><rect x="11.5" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" /></svg>
            : <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3.2v13.6L16.5 10z" fill="currentColor" /></svg>}
        </button>
        <button onClick={player.stop} aria-label="Fermer le lecteur" className="w-9 h-11 flex items-center justify-center shrink-0" style={{ color: C.nightMute }}>
          <Icon name="close" size={18} />
        </button>
        <span aria-hidden="true" className="absolute left-3.5 right-3.5 bottom-0 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,.14)' }}>
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: C.mango }} />
        </span>
      </div>
    </div>
  );
};

export default MiniPlayer;
