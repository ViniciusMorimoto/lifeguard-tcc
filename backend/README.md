# LifeGuard API

Backend Node.js/TypeScript do LifeGuard. A API usa Express 5, PostgreSQL, Prisma 7 e JWT. O simulador substitui temporariamente o ESP32 e inclui cenários de leitura normal, atenção, alerta válido, perda de contato e pico inválido.

## Requisitos

- Node.js 22.2 ou superior
- PostgreSQL 17, diretamente ou pelo Docker
- Docker Desktop apenas se optar pelo `docker compose`

## Preparação local

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run db:migrate -- --name initial
$env:DEMO_SEED_ENABLED='true'
$env:DEMO_SEED_PASSWORD = Read-Host 'Defina a senha local das contas de demonstração'
npm run db:seed:build
```

Inicie a API e o simulador em terminais separados:

```powershell
npm run dev
npm run simulator
```

A API fica disponível em `http://localhost:3333`. Verifique com `GET /health`.

## Contas de demonstração locais

- Cuidador: `ana@lifeguard.test`
- Paciente: `maria@lifeguard.test`

As duas contas usam a senha definida localmente em `DEMO_SEED_PASSWORD`. O seed fica bloqueado por padrão e não deve ser executado no banco de produção.

## Endpoints iniciais

- `POST /api/auth/cadastro`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/vinculos`
- `POST /api/vinculos/codigo`
- `POST /api/vinculos`
- `DELETE /api/vinculos/:vinculoId`
- `GET /api/idosos`
- `GET /api/idosos/:idosoId`
- `GET /api/idosos/:idosoId/leituras`
- `GET /api/idosos/:idosoId/limites`
- `PUT /api/idosos/:idosoId/limites`
- `POST /api/notificacoes/token`
- `DELETE /api/notificacoes/token`
- `POST /api/notificacoes/teste`
- `GET /api/alertas`
- `PATCH /api/alertas/:alertaId`

As rotas sob `/api`, exceto cadastro e login, exigem `Authorization: Bearer <token>`.

## Regra de segurança das leituras

Uma leitura só pode gerar alerta quando `valid = true` e `contactDetected = true`. Picos observados durante perda de contato são armazenados para diagnóstico, com qualidade do sinal e motivo de invalidação, mas não disparam emergência.

Essa regra é uma proteção técnica temporária, não uma validação clínica. Os parâmetros de qualidade e filtragem deverão ser calibrados com dados reais do hardware antes do uso final.

## Implantação na Oracle

O `Dockerfile`, o `compose.production.example.yml` e o `Caddyfile` deixam a API, o PostgreSQL e o HTTPS prontos para uma VM Ubuntu na Oracle Cloud.

Na VM, copie o arquivo de produção e crie um `.env` que não deve ser enviado ao Git:

```env
POSTGRES_PASSWORD=gere-uma-senha-alfanumerica-forte
JWT_SECRET=gere-uma-chave-aleatoria-com-64-ou-mais-caracteres
APP_ORIGIN=https://seu-painel-web.example.com
PUBLIC_HOST=api.seu-dominio.com
SMTP_HOST=smtp.email.sa-saopaulo-1.oci.oraclecloud.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario-smtp-gerado-pela-oracle
SMTP_PASSWORD=senha-smtp-gerada-pela-oracle
EMAIL_FROM=LifeGuard <remetente-aprovado@seu-dominio.com>
```

O envio de confirmação de e-mail e recuperação de senha usa SMTP com TLS. Na Oracle Email Delivery, crie um remetente aprovado na mesma região da VM e uma credencial SMTP exclusiva para a aplicação. As credenciais ficam somente no `.env` da VM.

Com as portas 80 e 443 liberadas e o domínio apontado para o IP público da VM, execute:

```bash
docker compose -f compose.production.yml up -d --build
```

O contêiner da API aplica as migrations ao iniciar. O PostgreSQL não é publicado na internet; somente o Caddy recebe tráfego externo e encaminha as requisições para a API por HTTPS. Verifique a implantação em `https://api.seu-dominio.com/health`.

## Backup e restauração

Os scripts em `ops/` criam backups diários criptografáveis pelo próprio disco da VM, com permissões restritas, validação do arquivo e retenção padrão de 14 dias. Uma vez por semana, o backup mais recente é restaurado em um banco temporário para confirmar que ele é utilizável; o banco principal não é alterado.

Na VM de produção, instale os agendamentos uma vez:

```bash
cd /home/ubuntu/lifeguard-tcc/backend
./ops/install-backup-timers.sh
sudo systemctl start lifeguard-backup.service
sudo systemctl start lifeguard-restore-test.service
systemctl list-timers 'lifeguard-*'
```

Os arquivos ficam em `/home/ubuntu/backups/lifeguard-postgres`, fora do repositório. O backup local protege contra erro no banco, mas não contra perda completa da VM; uma cópia externa deverá ser acrescentada antes de uso real em produção.

## Monitoramento da VM

O serviço `lifeguard-monitor` verifica a cada cinco minutos a rota pública `/health`, a conexão da API com o PostgreSQL e o uso do disco principal. O limite de disco padrão é 85%. Falhas e recuperações são registradas no journal e enviadas apenas na mudança de estado, evitando mensagens repetidas.

O workflow `monitor-production.yml` faz a verificação de fora da Oracle. Se a VM ou a API ficar inacessível, ele abre uma única issue de monitoramento no GitHub; quando o serviço se recuperar, a issue é fechada automaticamente. Assim, uma pane completa da própria VM também fica visível.

## Logs da API

A API escreve uma linha JSON por evento, com horário, nível, identificador da requisição, rota, status e duração. O mesmo identificador é devolvido no cabeçalho `X-Request-Id` e no corpo das respostas de erro, facilitando localizar um problema relatado. Os logs não incluem corpo da requisição, credenciais, códigos temporários, contato ou dados médicos; campos sensíveis também passam por uma proteção adicional antes da serialização. No Docker, cada serviço mantém no máximo cinco arquivos de 10 MB.

```bash
docker compose -f compose.production.yml logs --since 30m api
```

Para receber os avisos, crie `/etc/lifeguard-monitor.env` com permissão `600`:

```env
MONITOR_ALERT_EMAIL=responsavel@example.com
```

Os comandos úteis são:

```bash
sudo systemctl start lifeguard-monitor.service
sudo journalctl -u lifeguard-monitor.service --since today
systemctl list-timers 'lifeguard-*'
```
