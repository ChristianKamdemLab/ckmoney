import React, { useEffect, useRef, useState } from 'react';
import { C, dateFr } from './ui';
import { fetchDecryptageAudio, DecryptageDay } from '../../services/decryptageService';
import { frTypo } from '../../utils/articleText';

// « Le décryptage du jour » en tête de la page « L'info du jour » : à écouter seulement (choix de
// Christian, 24/11 : ni programme ni dialogue écrit). L'audio n'est chargé qu'au toucher.

const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const DecryptagePlayer: React.FC<{ d: DecryptageDay; autoFocus?: boolean }> = ({ d, autoFocus }) => {
  const [src, setSrc] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState({ t: 0, len: d.minutes * 60 });
  const audio = useRef<HTMLAudioElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => { if (autoFocus) box.current?.scrollIntoView({ block: 'start' }); }, [autoFocus]);

  const toggle = async () => {
    if (audio.current && src) { if (audio.current.paused) void audio.current.play(); else audio.current.pause(); return; }
    setState('loading');
    try { setSrc(await fetchDecryptageAudio(d.date)); setState('idle'); } catch { setState('error'); }
  };
  useEffect(() => { if (src && audio.current) void audio.current.play().catch(() => undefined); }, [src]);

  const guest = d.lines.find(l => l.who === 'guest')?.name || 'son invitée';
  const label = d.date === todayIso() ? 'Le décryptage du jour' : `Le décryptage du ${dateFr(d.date, { day: 'numeric', month: 'long' })}`;
  const pct = pos.len ? Math.min(100, (pos.t / pos.len) * 100) : 0;

  return (
    <div ref={box} className="rounded-[14px] overflow-hidden" style={{ background: C.night, color: C.nightText }}>
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11.5px] font-extrabold uppercase tracking-wide" style={{ color: C.mango }}>{label}</span>
          {d.draft && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: C.coral, color: '#fff' }}>Brouillon · toi seul</span>}
        </div>
        <h2 className="text-[21px] font-extrabold leading-[1.25] mt-1.5">{frTypo(d.title)}</h2>
        <div className="text-[13px] mt-1" style={{ color: C.nightMute }}>{d.minutes} min · Christian et {guest}</div>
      </div>
      <div className="px-5 pt-4 flex items-center gap-3.5">
        <button onClick={toggle} disabled={state === 'loading'} aria-label={playing ? 'Pause' : 'Écouter'}
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0" style={{ background: C.mango, color: C.ink }}>
          {state === 'loading' ? <span className="text-[12px] font-bold">…</span>
            : playing ? <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" /><rect x="11.5" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" /></svg>
            : <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3.2v13.6L16.5 10z" fill="currentColor" /></svg>}
        </button>
        <div className="flex-1 min-w-0">
          <div className="h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.16)' }}
            onClick={e => { if (!audio.current || !pos.len) return; const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); audio.current.currentTime = ((e.clientX - r.left) / r.width) * pos.len; }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.mango }} />
          </div>
          <div className="flex justify-between text-[12px] mt-1.5" style={{ color: C.nightMute }}>
            <span>{state === 'error' ? 'Audio indisponible, réessaie' : fmt(pos.t)}</span><span>{fmt(pos.len)}</span>
          </div>
        </div>
      </div>
      {src && (
        <audio ref={audio} src={src} preload="auto" className="hidden"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onLoadedMetadata={e => { const len = (e.target as HTMLAudioElement).duration; if (Number.isFinite(len)) setPos(p => ({ ...p, len })); }}
          onTimeUpdate={e => setPos(p => ({ ...p, t: (e.target as HTMLAudioElement).currentTime }))} />
      )}
      <div className="pb-5" />
    </div>
  );
};

export default DecryptagePlayer;
