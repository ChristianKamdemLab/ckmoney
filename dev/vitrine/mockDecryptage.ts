export const listDecryptage = async () => [{ date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()), title: 'Nvidia rappelle son patron, la COP repart sans accord', draft: true, minutes: 4, lines: [{ who: 'host', name: 'Christian', text: 'x' }, { who: 'guest', name: 'Nina', text: 'y' }],
  subjects: [{ title: 'Jensen Huang de retour chez Nvidia', link: '/?article=x' }, { title: 'COP31 : pas de texte final', link: '/?info' }, { title: 'Cameroun : les primaires secouent le RDPC', link: '' }],
  sources: [{ title: 'Le Monde', link: 'https://x.test' }, { title: 'Financial Times', link: 'https://x.test/2' }],
  lines: [{ who: 'host', name: 'Christian', text: 'Bonjour et bienvenue dans le décryptage du jour.' }, { who: 'guest', name: 'Nina', text: 'Bonjour Christian. On commence par une histoire de puces électroniques et de pouvoir.' }] }];
export const fetchDecryptageAudio = async (_d: string, part?: string) => part === 'jingle' ? '/sting-1.mp3' : '/sting-1.mp3';
import { player } from '../../services/player';
export const decryptageTrackId = (date: string) => `decryptage-${date}`;
export const playDecryptage = async (d: any, open?: () => void) => {
  const id = decryptageTrackId(d.date);
  if (player.get().track?.id === id && player.get().track!.queue.length) { player.toggle(); return; }
  player.play({ id, title: d.title, sub: 'Le décryptage', queue: ['/sting-1.mp3', '/sting-1.mp3'], open }, d.minutes * 60);
};
