import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

export function assertEmailConfigured() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.EMAIL_FROM) {
    throw new HttpError(503, 'O envio de e-mails ainda não está configurado.', 'EMAIL_NOT_CONFIGURED');
  }
}

function getTransport() {
  assertEmailConfigured();
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTLS: !env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}

function codeHtml(title: string, intro: string, code: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f1e7;font-family:Arial,sans-serif;color:#17383d"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><h1 style="margin:0 0 16px;font-size:28px">LifeGuard</h1><div style="background:#fff;border-radius:16px;padding:24px"><h2 style="margin-top:0">${title}</h2><p>${intro}</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;color:#e86f51">${code}</p><p>O código expira em 15 minutos e só pode ser usado uma vez.</p><p style="font-size:13px;color:#68777a">Se você não solicitou esta mensagem, ignore-a.</p></div></div></body></html>`;
}

async function sendCode(to: string, subject: string, title: string, intro: string, code: string) {
  await getTransport().sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text: `${intro}\n\nCódigo: ${code}\n\nO código expira em 15 minutos e só pode ser usado uma vez.`,
    html: codeHtml(title, intro, code),
  });
}

export function sendEmailVerificationCode(to: string, code: string) {
  return sendCode(to, 'Confirme seu e-mail no LifeGuard', 'Confirme seu e-mail', 'Digite este código no aplicativo para confirmar seu endereço:', code);
}

export function sendPasswordResetCode(to: string, code: string) {
  return sendCode(to, 'Recupere sua senha do LifeGuard', 'Recuperação de senha', 'Digite este código no aplicativo para criar uma nova senha:', code);
}

export function sendInfrastructureAlert(to: string, subject: string, text: string) {
  return getTransport().sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
  });
}
