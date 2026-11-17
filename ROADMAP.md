# Roadmap do LifeGuard

Estado mais recente das correções pós-VISIT, testes e implantação: [retomada de 18/10](docs/RETOMADA-2026-10-18.md). As listas históricas abaixo não comprovam implantação atual.

Este arquivo registra as próximas etapas do projeto. Por decisão do usuário em 11/10, o VISIT usará um simulador; ESP32 físico fica para depois.

## Próxima fila priorizada antes do ESP32

Situação revisada em 09/10/2026. Relatos antigos devem ser reproduzidos no APK atual antes de alterar o código.

### Foco para 13/10 — atualização em 11/10

- Priorizar demonstração sem hardware → API → paciente/cuidador, sem depender de Google.
- Simulador no app implementado: normal, batimento alto e sem contato; identificação explícita nos painéis, histórico e push. Roteiro em `docs/DEMONSTRACAO-VISIT.md`.
- Implementados provisionamento manual seguro, credencial revogável, ingestão com
  idempotência/relógio/qualidade, filtro de três amostras, fila de push para cuidadores
  e estado real de dispositivo no app. Contrato em `docs/ESP32-CONTRATO.md`.
- Ainda validar integração/CI, aplicar migration e implantar API, publicar OTA e
  testar dois celulares. Não declarar hardware pronto antes desses testes.
- Google segue com verificador pronto; rotas/vínculo/telas e APK nativo pendentes.

- [Implementado em 09/10; conferir nos aparelhos] Histórico compartilhado entre paciente e cuidador mede a largura interna do cartão; cabeçalho quebra linha e rótulos do gráfico se adaptam ao espaço. Média descreve as leituras exibidas (a API retorna as últimas 100, não necessariamente 24 horas).
- [Configuração Google concluída em 09/10; implementação pendente] Certificado do APK registrado no Firebase e clientes OAuth Android/Web criados em modo de teste. Identificadores públicos e roteiro em `docs/GOOGLE-LOGIN.md`. Próximo: integrar app/API com vínculo seguro por subject; módulo nativo exigirá novo APK-base. Não vincular contas existentes automaticamente apenas por coincidência de e-mail.

### P0 — Corrigir e proteger os fluxos de conta

- [Implementado; validação final pendente] Confirmar que um código correto funciona após uma tentativa errada; o backend permite cinco tentativas e agora há teste de regressão.
- [Implementado; validação final pendente] Impedir também na recuperação de senha por código que a nova senha seja igual à senha já cadastrada.
- [Implementado; validação final pendente] Manter a escolha Paciente/Cuidador ao navegar do login para o cadastro e ao voltar para o login.
- [Implementado; validação final pendente] Corrigir o defeito visual do campo “Li e concordo com os Termos de Uso e com a Política de Privacidade”; ainda conferir no APK com tela pequena e fonte ampliada.
- Executar testes automatizados dos quatro fluxos acima e publicar a correção na API/EAS Update.

### P1 — Fechar autenticação e segurança antes do hardware

- [Etapa local concluída em 09/10] Verificador criptográfico Google e 23 testes novos (37/37 na suíte). Ainda sem rotas, vínculo de contas, telas ou implantação; continuidade em `docs/GOOGLE-LOGIN.md`.
- Adicionar entrada e cadastro com Google usando OAuth/OIDC, vinculando com segurança contas que já usem o mesmo e-mail e preservando o tipo Paciente/Cuidador.
- Configurar os clientes Android/Web no Google, validar assinatura do APK e definir o comportamento para conta Google sem tipo escolhido.
- Fazer a rodada completa em dois celulares: cadastro, confirmação de e-mail, login, recuperação, sessões, vínculo, notificações, offline e exclusão de conta.
- Confirmar no ambiente de produção a rotação das credenciais, os backups restauráveis, os timers e a ausência de segredos versionados.

### P2 — Preparar a integração sem conectar fisicamente o ESP32

- Definir o contrato das leituras: identificador do dispositivo, paciente, batimentos, temperatura, horário, sequência e qualidade do sensor.
- Criar autenticação exclusiva do dispositivo, endpoint de ingestão e pareamento seguro com o paciente.
- Implementar validação, idempotência, limite de requisições e registro do último contato do dispositivo.
- Concluir no backend a regra de leituras anormais consecutivas, descarte de picos/perda de contato, intervalo entre alertas e aviso de normalização.
- Cobrir o fluxo completo com simulador e testes automatizados antes de aceitar dados reais.

### P3 — Distribuição e apresentação

- Validar EAS Update e gerar um APK-base definitivo somente quando houver mudança nativa.
- Automatizar deploy seguro da API e publicação das atualizações EAS.
- Criar página oficial de download com versão, notas e instruções de instalação.
- Adicionar monitoramento de falhas do aplicativo e preparar roteiro/material de demonstração.

### P4 — Conectar e calibrar o ESP32

- Gravar a configuração/credencial no ESP32 e pareá-lo a uma conta de teste.
- Validar envio, reconexão, relógio, duplicidade e funcionamento contínuo.
- Calibrar filtros e limites com dados reais, documentando que o protótipo não é um dispositivo médico validado.

## Concluído sem hardware

- Alteração de senha para usuários autenticados.
- Exclusão de conta com confirmação e tratamento em cascata dos dados relacionados.
- Termos de Uso e Política de Privacidade acessíveis no cadastro e no perfil.
- Proteção básica contra tentativas repetidas de login.
- Central de ajuda, perguntas frequentes e identificação da versão instalada.

## 1. Conta, privacidade e segurança

- [Concluído] Exportação dos próprios dados em arquivo JSON pelo menu nativo do celular, sem incluir credenciais ou tokens.
- [Concluído] Sessões revogáveis e opção de desconectar os outros aparelhos.
- [Concluído] Recuperação de senha e confirmação de e-mail com códigos temporários enviados pela Oracle Email Delivery.

## 2. Experiência e acessibilidade

- [Concluído] Abrir a tela correta ao tocar em uma notificação.
- [Concluído] Preferências de notificação por categoria, respeitadas pelo servidor.
- [Concluído] Cache criptografado e separado por conta dos últimos dados de monitoramento e alertas para consulta sem conexão.
- [Concluído] Revisão dos estados vazios, carregamento, erro, atualização e tentativa novamente nas telas conectadas à API.
- [Concluído] Revisão de acessibilidade: leitor de tela, contraste, tamanhos de toque e textos ampliados.
- [Concluído] Histórico de alterações importantes no perfil e nos limites do paciente, visível apenas ao paciente e aos cuidadores vinculados.

## 3. Confiabilidade da infraestrutura

- [Concluído] Backup automático diário, retenção de 14 dias e teste semanal de restauração do PostgreSQL.
- [Concluído] Monitoramento interno e externo da API, do PostgreSQL e do uso de disco da VM, com aviso sem duplicação no GitHub.
- [Concluído] Registro estruturado de requisições e erros, com correlação e rotação, sem armazenar dados sensíveis.
- [Concluído] Relatórios de entrega das notificações push e limpeza de tokens inválidos.
- Ambientes separados de teste e produção.
- Domínio próprio para a API.

## 4. Qualidade, distribuição e apresentação

- [Concluído] Testes automatizados iniciais das rotas, autenticação, vínculos e permissões.
- Testes de interface e roteiro de teste com dois ou mais celulares.
- [Concluído] Integração contínua para executar verificações a cada envio ao GitHub.
- Automação segura do deploy da API e das atualizações EAS.
- Site oficial com download do APK, versão e instruções de instalação.
- Notas da atualização no aplicativo.
- Monitoramento de falhas do aplicativo em produção.
- Material e roteiro de demonstração para a VISIT.

## 5. Etapa final: simulador e hardware

- Executar o simulador continuamente na Oracle durante os testes.
- Criar autenticação própria para o dispositivo e endpoint de envio de leituras.
- Integrar o ESP32 e associá-lo ao paciente correto.
- Exigir leituras anormais consecutivas antes de gerar alerta.
- Ignorar perda de contato e picos inválidos do sensor.
- Manter intervalo de segurança entre alertas repetidos.
- Avisar os cuidadores quando a condição voltar ao normal.
- Calibrar limites e filtros com dados reais, sem tratar a versão inicial como dispositivo médico validado.
