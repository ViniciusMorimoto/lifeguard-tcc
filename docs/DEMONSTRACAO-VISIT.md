# Demonstração VISIT — sem ESP32

Use uma conta de paciente de demonstração e outra de cuidador, vinculadas no app. Não use dados médicos reais na apresentação.

1. No paciente: Meu dispositivo → Preparar dispositivo ou simulador → Demonstração sem ESP32 → Preparar simulador. A confirmação desativa qualquer dispositivo anterior dessa conta, preservando o histórico.
2. Escolha Dentro dos limites e Iniciar simulação. A tela envia uma leitura fictícia a cada 5 segundos pela API hospedada. No cuidador, a home/detalhe atualiza automaticamente. Ambos mostram SIMULAÇÃO.
3. Pause, escolha Batimento acima do limite e inicie. Com 3 amostras válidas ao longo de pelo menos 8 segundos, um alerta é salvo. A fila de notificações verifica novos alertas a cada 15 segundos; a entrega também depende da internet e das permissões do celular do cuidador.
4. A notificação é enviada somente aos cuidadores vinculados que permitem alertas, com título Demonstração LifeGuard e mensagem [SIMULAÇÃO]. Abra a notificação e confira o alerta.
5. Pause e volte ao cenário normal. Após 3 amostras normais, o alerta de simulação é resolvido. Alertas reais não são resolvidos pelo simulador. Não há notificação de recuperação nesta versão.
6. Teste Sensor sem contato: as medidas ficam inválidas, não entram nas médias e não geram alerta de batimento alto, mesmo que o sensor simulado produza um pico.
7. Pause para demonstrar perda de comunicação. Após 90 segundos sem leitura, as telas de monitoramento mostram sem sinal e ocultam valores antigos.

## Limites importantes

- Marcar um alerta como resolvido não significa que o sinal normalizou. Enquanto as leituras continuarem alteradas, não é criado outro alerta do mesmo episódio; retorne a três leituras normais antes de repetir.

- O simulador pausa quando esta tela perde o foco ou o aplicativo vai para segundo plano. Uma requisição já enviada ainda pode terminar. Para demonstrar notificações, deixe o paciente nesta tela e use outro celular como cuidador.
- Há no máximo um alerta aberto por tipo. Para repetir a demonstração, volte ao cenário normal até 3 leituras resolverem o alerta, então escolha batimento alto novamente. O intervalo de 10 minutos continua aplicado aos dispositivos reais.
- Para o cenário alto, o limite máximo de batimento precisa ser menor que 240 bpm. Use os limites padrão da conta de demonstração.
- As leituras são persistidas como SIMULATOR; o histórico informa quando contém dados fictícios. Alertas de simulação e reais são separados na resolução e no intervalo mínimo.
- A notificação usa a mesma infraestrutura da aplicação real. Isso demonstra o percurso completo app → API → banco → cuidador, mas não valida sensores, hardware ou precisão clínica.
- Esta versão é um protótipo acadêmico, não um dispositivo médico nem substituto de serviços de emergência.

## Pendências separadas

Login Google ainda precisa da integração nas rotas/telas e testes com conta real. ESP32/firmware/pinagem e validação dos sensores ficam após o VISIT. Consulte ESP32-CONTRATO.md para o contrato já preparado.
