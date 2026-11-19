# LifeGuard — contrato de integração (11/10/2026)

## Estado

Implementação no código; conferir registro de implantação antes de usar em produção.
Não grava firmware, não faz Bluetooth e não valida a precisão dos sensores.

1. Paciente entra no app: Meu dispositivo → Preparar dispositivo.
2. O servidor registra o único dispositivo ativo do paciente com o nome fixo
   `LifeGuard` e gera credencial aleatória, exibida uma vez. O banco guarda somente
   SHA-256 do segredo.
3. Transfere manualmente a credencial para configuração local do firmware (fora do Git).
4. LifeGuard conecta ao Wi-Fi, sincroniza UTC via NTP e envia uma leitura a cada 5 segundos.
5. A tela consulta o servidor; não apresenta mais conexão ou pareamento simulados.
6. O paciente mantém apenas um dispositivo ativo. Para trocar o Wi-Fi, reconfigure o
   LifeGuard sem revogar a credencial; para substituir o equipamento, desconecte o atual.

Não colocar senha da conta, token de usuário, banco ou segredo JWT no firmware.
A credencial do hardware serve APENAS para enviar leituras do paciente proprietário.

## Requisição

`POST https://152-67-44-170.sslip.io/api/dispositivos/leituras`

Headers: `Content-Type: application/json` e `Authorization: Bearer <credencial>`.
Validar certificado TLS no firmware; **não usar setInsecure()**.

```json
{
  "sampleId": "db91cf3b-bd5b-4eea-9506-6dca52ac5182",
  "timestamp": "2026-10-11T18:00:00.000Z",
  "heartRate": 75,
  "temperature": 36.5,
  "contactDetected": true,
  "signalQuality": "GOOD"
}
```

O horário acima é apenas exemplo: usar UTC atual. `sampleId` UUID novo por amostra,
mantido nas retentativas. Não enviar IDs de pacientes, flag `valid` ou `source`.
Medidas ausentes são `null`. Qualidade: GOOD, FAIR, POOR, NO_CONTACT, UNKNOWN.
Para dedo retirado, enviar `contactDetected: false`; a API não consegue inferir
contato físico confiavelmente se o firmware mentir ou o sensor não o detectar.

- 201: amostra criada; `valida` informa se foi aceita como medida.
- 200 + `duplicada: true`: retentativa idêntica já recebida; não duplica leitura/alerta.
- 400: formato/relógio incorreto (até 120 s passado ou 10 s futuro).
- 401: credencial ausente, revogada ou inválida; precisa configurar novamente.
- 409: UUID reutilizado com outro conteúdo ou leitura fora de ordem.
- 429: aguardar `Retry-After` (30 requisições/minuto/IP para ingestão).
- 5xx/timeout: repetir MESMO UUID e MESMO corpo com espera progressiva.

Sem contato, sinal ruim/desconhecido, ausência de medidas ou valores fora da faixa
técnica (30–250 bpm; 30–45 °C) impedem a amostra de ser considerada válida para
monitoramento. Cada sensor é filtrado separadamente: uma temperatura dentro da faixa
continua registrada e pode ser exibida mesmo sem contato do sensor de pulso; nesse caso,
o estado geral permanece `sem_sinal`. Valores de temperatura fora da faixa são nulos,
sem descartar um batimento válido.
Esses números são filtros técnicos do protótipo, não limites clínicos recomendados.
Temperatura deve ser corporal: sensor ambiente não equivale a medição corporal.
O histórico apresenta médias, picos e mínimos por hora; o gráfico mostra os últimos
cinco minutos em pontos médios de dez segundos. O visor mantém a última temperatura
técnica válida e seu horário, independentemente do contato do sensor de pulso.

## Alertas e conexão

- Três amostras válidas seguidas na mesma direção (alta ou baixa), abrangendo
  8–30 segundos, confirmam um alerta. Amostra inválida interrompe a sequência.
- Não cria novos alertas enquanto o episódio permanecer aberto.
- Três amostras normais resolvem o episódio. Intervalo mínimo de 10 minutos por
  tipo/paciente limita novos episódios. Recuperação aparece no estado do alerta;
  notificação separada de normalização ainda não foi implementada.
- Fila persistente processada a cada 15 s, até cinco tentativas espaçadas em 2 min.
  Destinatários: apenas cuidadores com vínculo ativo e preferências habilitadas.
  Entrega push depende de rede/provedor: retentativa após resposta perdida pode
  duplicar entrega; não é garantia de entrega única nem sistema de emergência.
- Sem leitura recente por 90 s: `sem_sinal`; home mantém os últimos valores mensuráveis e
  informa o horário do último registro. Meu dispositivo considera último contato,
  não a validade da medida.
- O ponto de acesso para configuração se chama `LIFEGUARD`. Para reconfigurar o Wi-Fi,
  mantenha o botão BOOT pressionado por 3 segundos quando o firmware tiver suspendido
  o modo de configuração; a credencial do LifeGuard é mantida.
- Revogação preserva histórico e impede novos envios; gerar outra credencial troca
  o dispositivo somente depois de desconectar o atual. Não requer apagar dados do paciente.

## Antes da demonstração

- Aplicar migration `20261011000100_device_ingestion` na VM após backup.
- Validar integração com PostgreSQL descartável no CI; não simular saúde de pessoas reais.
- Publicar o firmware atualizado e a API antes de distribuir o app, pois o nome do ponto
  de acesso mudou para `LIFEGUARD`. A tela também informa como reabrir a configuração.
- Confirmar fluxo em dois celulares e credencial inválida/revogada.
- Confirmar modelo da placa, sensor cardíaco, sensor de temperatura, pinagem e firmware
  atual antes de escrever/gravar código no hardware. Ainda não foi conectado/testado.
- Google continua pendente nas rotas/telas: login por senha já existente serve ao ESP32.

Consultas de operação: conferir jobs `DeviceAlertDispatch` com `sentAt IS NULL`
e `attempts >= 5`; avaliar erro antes de reprocessar para não duplicar notificações.
