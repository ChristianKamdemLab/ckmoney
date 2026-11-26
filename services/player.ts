import { useEffect, useState } from 'react';

// Lecteur audio de toute l'appli (26/11) : un seul élément <audio>, hors des écrans, pour que le décryptage
// continue quand on change d'onglet ou d'écran. Le mini-lecteur (MiniPlayer) l'affiche au-dessus du menu.
// Une piste est une file de sons joués à la suite (le jingle, puis les voix : jamais collés dans un même
// fichier, le téléphone s'arrêtait au changement de format).

export interface Track { id: string; title: string; sub: string; queue: string[]; open?: () => void }
export interface PlayerState { track: Track | null; playing: boolean; loading: boolean; part: number; t: number; len: number; error: boolean }

let audio: HTMLAudioElement | null = null;
let state: PlayerState = { track: null, playing: false, loading: false, part: 0, t: 0, len: 0, error: false };
const subs = new Set<(s: PlayerState) => void>();
const emit = (patch: Partial<PlayerState>) => { state = { ...state, ...patch }; subs.forEach(f => f(state)); };
const isLast = () => !!state.track && state.part >= state.track.queue.length - 1;

const el = () => {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'auto';
  audio.onplay = () => emit({ playing: true, loading: false });
  audio.onpause = () => emit({ playing: false });
  audio.onerror = () => { if (!isLast()) next(); else emit({ playing: false, loading: false, error: true }); };
  audio.onended = () => { if (!isLast()) next(); else emit({ playing: false, t: 0 }); };
  audio.onloadedmetadata = () => { if (isLast() && Number.isFinite(audio!.duration)) emit({ len: audio!.duration }); };
  audio.ontimeupdate = () => { if (isLast()) emit({ t: audio!.currentTime }); };
  return audio;
};
const next = () => {
  const a = el();
  emit({ part: state.part + 1 });
  a.src = state.track!.queue[state.part];
  void a.play().catch(() => emit({ playing: false }));
};

export const player = {
  get: () => state,
  /** Lance une piste (ou reprend celle en cours). */
  play: (track: Track, lenHint = 0) => {
    const a = el();
    if (state.track?.id === track.id) { void a.play().catch(() => undefined); return; }
    const queue = track.queue.filter(Boolean);
    emit({ track: { ...track, queue }, part: 0, t: 0, len: lenHint, error: false, loading: true });
    a.src = queue[0];
    void a.play().catch(() => emit({ playing: false, loading: false }));
  },
  /** Prépare une piste qui se charge (le lecteur montre « … »). */
  loading: (id: string, title: string, sub: string) => emit({ track: { id, title, sub, queue: [] }, loading: true, playing: false, error: false, part: 0, t: 0 }),
  failed: () => emit({ loading: false, error: true }),
  toggle: () => { const a = el(); if (!state.track) return; if (a.paused) void a.play().catch(() => undefined); else a.pause(); },
  seek: (ratio: number) => { const a = el(); if (isLast() && state.len) a.currentTime = Math.max(0, Math.min(1, ratio)) * state.len; },
  stop: () => { const a = el(); a.pause(); a.removeAttribute('src'); a.load(); emit({ track: null, playing: false, loading: false, part: 0, t: 0, len: 0, error: false }); },
  subscribe: (f: (s: PlayerState) => void) => { subs.add(f); return () => { subs.delete(f); }; },
};

export const usePlayer = () => {
  const [s, setS] = useState(state);
  useEffect(() => player.subscribe(setS), []);
  return s;
};
