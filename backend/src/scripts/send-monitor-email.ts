import { sendInfrastructureAlert } from '../services/email.js';

const [to, subject, text] = process.argv.slice(2);

if (!to || !subject || !text) {
  throw new Error('Uso: send-monitor-email <destinatário> <assunto> <mensagem>');
}

await sendInfrastructureAlert(to, subject, text);
console.log('Aviso de infraestrutura enviado.');
