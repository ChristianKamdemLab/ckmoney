import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import ArticlesScreen from '../../components/v2/Articles';
import Jambo, { JamboTable } from '../../components/v2/Jambo';
import LenderTabs from '../../components/v2/LenderTabs';
import { newGame, play, claim, Game } from '../../games/fapfap';

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const user = { id: 'me', name: 'Christian', email: 'c@x.fr' };
const v = new URLSearchParams(location.search).get('v') || 'home';
const names = [{ name: 'Christian', human: true }, { name: 'Tonton', human: false }, { name: 'La Go', human: false }];

let el: React.ReactNode = null;
if (v === 'home-old') el = <LenderTabs tab="loans" user={user} profile={null} loans={[]} loading={false} onOpenLoan={() => {}} onCreate={() => {}} onEditProfile={() => {}} onLogout={() => {}} onLegal={() => {}} requestLink="https://ck-money.vercel.app/christian" onArticles={() => {}} onJambo={() => {}} onBac={() => {}} onWiseman={() => {}} onEvents={() => {}} onMot={() => {}} onInfo={() => {}} onVendredi={() => {}} onAdresses={() => {}} onRadio={() => {}} />;
if (v === 'articles') el = <ArticlesScreen user={user} isAuthor={false} onBack={() => {}} />;
if (v === 'articles-author') el = <ArticlesScreen user={user} isAuthor onBack={() => {}} />;
if (v.startsWith('read')) el = <ArticlesScreen user={user} isAdmin={false} onBack={() => {}} initialId={v.slice(4) || 'a0'} />;
if (v === 'jambo') el = <Jambo playerName="Christian" onBack={() => {}} />;
if (v === 'table') {
  // Tonton commande et a joué ; c'est à La Go puis à moi
  let g: Game = newGame(names, 10, seeded(11));
  g = { ...g, leader: 1, turn: 1 };
  g = play(g, 1, g.players[1].hand[0]);
  el = <JamboTable initial={g} onQuit={() => {}} onReplay={() => {}} />;
}
if (v === 'table2') {
  let g: Game = newGame([names[0], names[1]], 10, seeded(5));
  el = <JamboTable initial={g} onQuit={() => {}} onReplay={() => {}} />;
}
if (v === 'claim') {
  let g: Game = newGame(names, 10, seeded(3));
  g = { ...g, players: g.players.map((p, i) => i === 0 ? { ...p, hand: [{ r: 7, s: 'coeur' }, { r: 7, s: 'pique' }, { r: 7, s: 'trefle' }, { r: 9, s: 'carreau' }, { r: 4, s: 'coeur' }] } : p) };
  el = <JamboTable initial={g} onQuit={() => {}} onReplay={() => {}} />;
}
if (v === 'end') {
  let g: Game = newGame(names, 10, seeded(3));
  g = { ...g, players: g.players.map((p, i) => i === 0 ? { ...p, score: 4, hand: [{ r: 7, s: 'coeur' }, { r: 7, s: 'pique' }, { r: 7, s: 'trefle' }, { r: 9, s: 'carreau' }, { r: 4, s: 'coeur' }] } : { ...p, score: i }) };
  g = claim(g, 0);
  el = <JamboTable initial={g} onQuit={() => {}} onReplay={() => {}} />;
}
// Jambo en ligne (serveur simulé dans la page)
import JamboOnline from '../../components/v2/JamboOnline';
if (v === 'online') el = <JamboOnline defaultName="Christian" guest onExit={() => {}} />;
if (v === 'join') {
  const { call } = await import('./mockJamboOnline');
  const { code } = await call('chris', 'create', { name: 'Christian', target: 10 });
  await call('ben', 'join', { code, name: 'Ben' });
  el = <JamboOnline code={code} defaultName="" guest onExit={() => {}} />;
}

import FilmsScreen from '../../components/v2/Films';
if (v === 'films') el = <FilmsScreen onBack={() => {}} />;
import VendrediScreen from '../../components/v2/Vendredi';
import AdressesScreen from '../../components/v2/Adresses';
if (v === 'vendredi') el = <VendrediScreen onBack={() => {}} />;
if (v === 'adresses') el = <AdressesScreen onBack={() => {}} />;
import InfoScreen from '../../components/v2/Info';
if (v === 'info') el = <InfoScreen onBack={() => {}} />;
import Mot from '../../components/v2/Mot';
if (v === 'mot') el = <Mot onBack={() => {}} />;
import Bac from '../../components/v2/Bac';
if (v === 'bac') el = <Bac playerName="Christian" guest />;

import Wiseman from '../../components/v2/Wiseman';
if (v === 'wiseman') el = <Wiseman playerName="Christian" guest />;

import Auth from '../../components/v2/Auth';
import { InstallSheet } from '../../components/v2/Install';
if (v === 'auth') el = <Auth />;
if (v === 'install') el = <InstallSheet open onClose={() => {}} />;
import EventsScreen from '../../components/v2/Events';
if (v === 'events') el = <EventsScreen isAdmin={false} onBack={() => { (window as any).backs = ((window as any).backs || 0) + 1; }} />;
if (v.startsWith('guest-')) el = <EventsScreen isAdmin={false} onBack={() => {}} initialId={v.slice(6)} />;
if (v === 'events-author') el = <EventsScreen isAdmin me="Christian Kamdem" onBack={() => {}} />;
if (v.startsWith('event-')) el = <EventsScreen isAdmin onBack={() => {}} initialId={v.slice(6)} />;
import { decodePrefill } from '../../utils/events';
if (v === 'events-prefill') el = <EventsScreen isAdmin onBack={() => {}} prefill={decodePrefill(new URLSearchParams(location.search).get('p') || '')} />;
import { BorrowerSpace, RequestBlocked } from '../../components/v2/FriendFlows';
import RequestReview from '../../components/v2/RequestReview';
import { buildSchedule } from '../../utils/schedule';
{
  const friend = { id: 'ami', name: 'Ami Test', email: 'a@x.fr' };
  const sch = buildSchedule({ amount: 150, annualRate: 0, loanDate: '2026-11-11', repaymentType: 'in_fine', repaymentDate: '2026-12-07' });
  const mk = (id: string, status: string, extra: any = {}) => ({ id, status, borrowerUid: 'ami', lenderUid: 'chris', lenderName: 'Christian Kamdem', amount: 150, currency: 'EUR',
    loanDate: '2026-11-11', repaymentDate: '2026-12-07', schedule: sch, interestRate: 0, lateRateMode: 'legal', payments: [], createdAt: '2026-11-11', ...extra }) as any;
  const sp = (loans: any[]) => <BorrowerSpace user={friend} profile={null} loans={loans} loading={false} onOpenLoan={() => {}} onRequest={(u, n) => { document.title = `request:${u}:${n}`; }}
    onEditIdentity={() => {}} onLogout={() => {}} onLegal={() => {}} onOpenContract={() => {}} onArticles={() => {}} onJambo={() => {}} onBac={() => {}} onWiseman={() => {}} onEvents={() => {}} onRadio={() => {}} onMot={() => {}} onInfo={() => {}} onVendredi={() => {}} onAdresses={() => {}} onFilms={() => {}} onBecomeLender={() => { document.title = 'lend'; }} />;
  if (v === 'friend-empty') el = sp([]);
  if (v === 'friend-paid') el = sp([mk('old', 'paid')]);
  if (v === 'friend-active') el = sp([mk('a', 'active')]);
  if (v === 'friend-requested') el = sp([mk('r', 'requested')]);
  if (v === 'blocked') el = <RequestBlocked loan={mk('a', 'active')} lenderFirstName="Christian" onOpen={() => {}} onBack={() => {}} />;
  if (v === 'review') {
    const me = { id: 'chris', name: 'Christian', email: 'c@x.fr' };
    const req = mk('r2', 'requested', { borrowerNickname: 'Ami', borrowerReceive: { method: 'paypal', value: 'https://www.paypal.me/unpseudoassezlong' } });
    el = <RequestReview loan={req} user={me} profile={{ fullName: 'Christian Kamdem', signature: 'x' } as any} loans={[req, mk('a', 'active')]} onBack={() => {}} onChanged={() => {}} onModify={() => {}} />;
  }
}
import LoanDetail from '../../components/v2/LoanDetail';
{
  const sch = buildSchedule({ amount: 150, annualRate: 0, loanDate: '2026-10-29', repaymentType: 'in_fine', repaymentDate: '2026-11-05' });
  const pay = (id: string, amount: number, method: string, status = 'confirmed') => ({ id, amount, method, status, date: '2026-11-13', declaredBy: 'borrower', declaredAt: '2026-11-13' });
  const base: any = { id: 'pm', status: 'active', lenderUid: 'chris', borrowerUid: 'pm', borrowerNickname: 'PM', lenderName: 'Christian Kamdem', amount: 150, currency: 'EUR', loanDate: '2026-10-29', repaymentDate: '2026-11-05',
    schedule: sch, interestRate: 0, lateRateMode: 'legal', penaltyRate: 10, createdAt: '2026-11-11', borrowerSignedAt: '2026-11-12T10:13:00Z' };
  const me = { id: 'chris', name: 'Christian', email: 'c@x.fr' };
  if (v === 'pm-now') el = <LoanDetail loan={{ ...base, payments: [pay('a', 150, 'PayPal'), pay('b', 165.22, 'Virement')] }} user={me} profile={{ fullName: 'Christian Kamdem' } as any} onBack={() => {}} onChanged={() => {}} />;
  if (v === 'pm-after') el = <LoanDetail loan={{ ...base, lateFeesWaivedAt: '2026-11-13', payments: [pay('a', 150, 'PayPal'), pay('b', 165.22, 'Virement', 'cancelled')] }} user={me} profile={{ fullName: 'Christian Kamdem' } as any} onBack={() => {}} onChanged={() => {}} />;
  if (v === 'pm-late') el = <LoanDetail loan={{ ...base, payments: [pay('d', 50, 'PayPal', 'declared')] }} user={me} profile={{ fullName: 'Christian Kamdem' } as any} onBack={() => {}} onChanged={() => {}} />;
  if (v === 'pm-friend') el = <LoanDetail loan={{ ...base, payments: [] }} user={{ id: 'pm', name: 'PM', email: 'p@x.fr' }} profile={null} onBack={() => {}} onChanged={() => {}} />;
}
import RadioScreen from '../../components/v2/Radio';
if (v === 'radio' || v === 'radio-author') el = <RadioScreen onBack={() => {}} />;
if (v === 'radio-read') el = <RadioScreen onBack={() => {}} initialId="r1" />;
import NewLoanFlow from '../../components/v2/NewLoanFlow';
if (v === 'counter') {
  const sara: any = { id: 'req1', status: 'requested', borrowerUid: 'sara', borrowerNickname: 'Sara', amount: 150, currency: 'EUR', schedule: [], createdAt: '2026-11-13' };
  el = <NewLoanFlow user={{ id: 'chris', name: 'Christian', email: 'c@x.fr' }} profile={{ fullName: 'Christian Kamdem', signature: 'data:image/png;base64,iVBORw0KGgo=', penaltyRate: 10 } as any} loans={[]}
    prefill={{ friend: { uid: 'sara', nickname: 'Sara', lastLoan: sara } as any, amount: 150, dueDate: '2026-12-20', counterOf: 'req1' }} onClose={() => { document.title = 'closed'; }} onDone={() => {}} />;
}
import ProfileSetup from '../../components/ProfileSetup';
import LegalDocs from '../../components/LegalDocs';
{
  const friend = { id: 'ami', name: 'Ami Test', email: 'a@x.fr' };
  if (v === 'friend-via') el = <BorrowerSpace user={friend} profile={{ viaLenders: ['chris'] } as any} loans={[]} loading={false} onOpenLoan={() => {}} onRequest={(u, n) => { document.title = `request:${u}:${n}`; }}
    onEditIdentity={() => {}} onLogout={() => {}} onLegal={() => {}} onOpenContract={() => {}} onArticles={() => {}} onJambo={() => {}} onBac={() => {}} onWiseman={() => {}} onEvents={() => {}} onRadio={() => {}} onMot={() => {}} onInfo={() => {}} onVendredi={() => {}} onAdresses={() => {}} onFilms={() => {}} onBecomeLender={() => {}} />;
  if (v === 'lend') el = <ProfileSetup user={friend} initial={null} lending onCancel={() => {}} onSaved={() => { document.title = 'saved'; }} />;
  if (v === 'cgu' || v === 'privacy') el = <LegalDocs view={v as any} onClose={() => {}} />;
}
// Nouvelle interface (26/11)
import { HomeTab, ActuTab, AmisTab } from '../../components/v2/Home';
import { TabBar, MainTab } from '../../components/v2/ui';
import MiniPlayer from '../../components/v2/MiniPlayer';
if (v.startsWith('shell')) {
  const Shell = () => {
    const [tab, setTab] = React.useState<MainTab>((new URLSearchParams(location.search).get('tab') as MainTab) || 'home');
    const nav: any = new Proxy({}, { get: (_t, k) => k === 'onTab' ? setTab : () => {} });
    const fake: any[] = [{ id: 'l1', lenderUid: 'me', borrowerUid: 'b1', borrowerName: 'Ami Test', lenderName: 'Christian', amount: 300, currency: 'EUR', status: 'active', loanDate: '2026-10-20', repaymentDate: '2026-11-20', dueDate: '2026-11-20', firstDueDate: '2026-11-20', repaymentType: 'single', createdAt: '2026-10-20T10:00:00Z', payments: [], installments: 1, frequency: 'once' },
      { id: 'd1', lenderUid: 'me', borrowerUid: 'b2', borrowerNickname: 'Inès', borrowerName: 'Inès', amount: 20, currency: 'EUR', status: 'declined', initiatedBy: 'borrower', createdAt: new Date(Date.now() - 6 * 86400_000).toISOString(), payments: [], schedule: [] }];
    return (<>
      {tab === 'home' && <HomeTab user={user} profile={{ fullName: 'Christian Kamdem' } as any} loans={fake} isLender nav={nav} />}
      {tab === 'actu' && <ActuTab user={user} nav={nav} />}
      {tab === 'amis' && <AmisTab nav={nav} />}
      {tab === 'podcasts' && <RadioScreen asTab />}
      {tab === 'loans' && <LenderTabs tab="loans" user={user} profile={null} loans={fake} loading={false} onOpenLoan={() => {}} onCreate={() => {}} onEditProfile={() => {}} onLogout={() => {}} onLegal={() => {}} requestLink="https://ck-money.vercel.app/christian" onArticles={() => {}} onJambo={() => {}} onBac={() => {}} onWiseman={() => {}} onEvents={() => {}} />}
      {tab === 'profile' && <LenderTabs tab="profile" user={user} profile={null} loans={fake} loading={false} onOpenLoan={() => {}} onCreate={() => {}} onEditProfile={() => {}} onLogout={() => {}} onLegal={() => {}} requestLink="https://ck-money.vercel.app/christian" onArticles={() => {}} onJambo={() => {}} onBac={() => {}} onWiseman={() => {}} onEvents={() => {}} />}
      <MiniPlayer withTabs />
      <TabBar tab={tab} onTab={setTab} badge={1} />
    </>);
  };
  el = <Shell />;
}
createRoot(document.getElementById('root')!).render(el);
