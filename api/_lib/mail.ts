import nodemailer from 'nodemailer';

// Rappels par e-mail, envoyés gratuitement depuis le Gmail du prêteur
// (variables Vercel GMAIL_USER et GMAIL_APP_PASSWORD : mot de passe d'application Google).
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;
const transport = user && pass ? nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) : null;

const APP = 'https://ck-money.vercel.app';
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const mailEnabled = () => !!transport;

export const sendReminderMail = async (args: {
  to: string; replyTo?: string; fromName: string; subject: string; title: string; body: string; loanId: string; payUrl?: string | null; payLabel?: string;
}) => {
  if (!transport || !args.to) return false;
  const open = `${APP}/?loan=${args.loanId}`;
  const btn = (href: string, label: string, bg: string) =>
    `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;margin:4px 8px 4px 0">${esc(label)}</a>`;
  const html = `<!doctype html><html><body style="margin:0;background:#F7F6F2;font-family:Figtree,Arial,sans-serif;color:#1C2551">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <div style="display:inline-block;background:#C98A1E;color:#fff;font-weight:800;border-radius:10px;padding:8px 10px">CK</div>
    <span style="font-weight:800;font-size:18px;margin-left:8px">CK<span style="color:#C98A1E">Money</span></span>
    <div style="background:#fff;border-radius:18px;padding:22px;margin-top:20px">
      <h1 style="font-size:20px;margin:0 0 10px">${esc(args.title)}</h1>
      <p style="font-size:15px;line-height:1.55;color:#3A3E52;margin:0 0 18px">${esc(args.body)}</p>
      ${args.payUrl ? btn(args.payUrl, args.payLabel || 'Payer', '#1C2551') : ''}${btn(open, 'Ouvrir CKMoney', args.payUrl ? '#6B6F80' : '#1C2551')}
    </div>
    <p style="font-size:12px;color:#6B6F80;line-height:1.5;margin-top:16px">Tu reçois ce rappel parce que tu as signé un contrat de prêt sur CKMoney. Pour répondre, réponds simplement à cet e-mail.</p>
  </div></body></html>`;
  try {
    await transport.sendMail({
      from: `"${args.fromName} via CKMoney" <${user}>`, to: args.to, replyTo: args.replyTo || user,
      subject: args.subject, html, text: `${args.title}\n\n${args.body}\n\n${args.payUrl ? `Payer : ${args.payUrl}\n` : ''}Ouvrir CKMoney : ${open}`,
    });
    return true;
  } catch (e: any) { console.error('mail', e?.message); return false; }
};
