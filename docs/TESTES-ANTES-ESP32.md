# Verificação antes de conectar o ESP32

## Testes automatizados

O workflow `quality.yml` cria PostgreSQL descartável, aplica todas as migrations,
verifica TypeScript, exporta o bundle Android e executa testes unitários e HTTP.
O teste de integração não aceita NODE_ENV de produção nem banco sem sufixo `_test`.

Localmente, com um PostgreSQL exclusivo em localhost e permissão para criar bancos:

```powershell
cd backend
# Defina DATABASE_URL com a conexão LOCAL de teste, sem usar credenciais de produção.
node scripts/test-local.mjs
```

O script cria um banco com nome aleatório, aplica migrations e o remove ao terminar.
Não altera o banco original. Alternativa: `docker compose -f compose.test.yml up -d`.
Esse compose publica somente em localhost e usa armazenamento temporário.

## Roteiro em dois celulares

Use contas de teste e registre versão do APK, modelo do aparelho e resultado.

1. Instalar o APK 1.11.0 como atualização e abrir sem USB ou Metro.
2. Confirmar logo, splash, textos legíveis e ausência de recortes com fonte ampliada.
3. No login, selecionar Cuidador e abrir o cadastro; confirmar que Cuidador continua selecionado. Repetir com Paciente e então criar paciente no celular A e cuidador no B.
4. Conferir validações, telefone e o cartão de aceite dos termos em tela pequena e com fonte ampliada; caixa e links devem permanecer alinhados e tocáveis.
5. Confirmar e-mail digitando primeiro um código errado e depois o correto; a segunda tentativa deve funcionar. Conferir também expiração e limite de cinco tentativas.
6. Recuperar a senha; a senha atual deve ser recusada como nova e o código deve continuar utilizável para escolher outra senha válida.
7. Gerar código no A; vincular no B. O mesmo código não deve funcionar novamente.
8. Editar foto e perfil; conferir foto nas listas, homes e informações do paciente.
9. Testar saída durante edição, teclado, tela pequena e leitor de tela.
10. Enviar teste de notificação aos cuidadores no A. Conferir o B aberto, em segundo
   plano e fechado; tocar deve abrir a tela correta.
11. Consultar entregas no perfil do destinatário após 15 minutos. "Encaminhado" não
   comprova visualização; é a confirmação do provedor FCM/APNs.
12. Desativar preferências, desconectar outros dispositivos e testar a revogação.
13. Remover vínculo: o antigo cuidador não deve mais acessar o perfil/leituras.
14. Desligar internet: conferir aviso, cache da própria conta e botão de tentar novamente.
15. Exportar dados pelo compartilhamento nativo; excluir apenas contas de teste.
16. Abrir Histórico como paciente e pelo perfil do paciente na conta cuidador.
    Alternar batimento/temperatura, girar a tela e ampliar a fonte: gráfico, média
    e limites devem ficar dentro do cartão. Conferir sem dados, uma leitura e
    100 leituras (somente em ambiente de teste, sem inserir dados na produção).

## Infraestrutura ainda precisa de validação

- Recuperar SSH da VM, implantar código e migrations e testar rollback.
- Substituir/revogar a credencial SMTP historicamente exposta.
- Confirmar timers de backup, restauração e monitoramento ativos.
- Manter cópia criptografada de backup fora da VM e testar restauração.
- Configurar homologação remota separada; o banco descartável local/CI não a substitui.
- Domínio próprio depende de escolha/registro; sslip.io permanece em uso.

## Pareamento do ESP32

1. Gravar `firmware/esp32_lifeguard/esp32_lifeguard.ino` no ESP32 e configurar o certificado da API conforme o README do firmware.
2. No APK Android 10 ou superior, tocar em **Conectar ao LIFEGUARD-ESP32** e aceitar o pedido de conexão do Android. Em aparelhos mais antigos, abrir as configurações de Wi-Fi, conectar manualmente à rede `LIFEGUARD-ESP32` e voltar ao app. A rede do ESP32 não tem internet; isso é esperado e não impede a configuração.
3. Repetir em **Bluetooth (BLE)**, conceder acesso a dispositivos próximos, encontrar `LIFEGUARD-ESP32` e enviar a mesma configuração.
4. Após enviar a configuração, o ESP32 reinicia. Observar o Monitor Serial em 115200 baud: confirmar `Wi-Fi conectado` com IP, `Relógio sincronizado` e resposta `Leitura enviada (200/201)`. Se ficar sem sinal, usar essas mensagens para identificar se parou na associação ao Wi-Fi, no NTP ou na resposta da API. A conexão do telefone ao AP apenas configura o dispositivo; as leituras chegam ao servidor pela conexão Wi-Fi configurada no ESP32.
5. Testar negação de permissões, ESP32 desligado, senha inválida e tentativa de alterar a rede. O app deve mostrar erro acionável e permitir tentar novamente.

Esse fluxo ainda depende de teste com hardware real. Não usar dados simulados como medições reais nem como validação clínica.
