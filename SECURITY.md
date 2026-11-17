# Segurança do LifeGuard

## Como relatar uma vulnerabilidade

Não publique credenciais, dados pessoais ou detalhes exploráveis em uma issue pública. Envie o relato diretamente ao responsável pelo projeto e inclua apenas a descrição, o impacto e os passos mínimos para reprodução, sem dados reais de pacientes.

## Regras para segredos

- Arquivos `.env`, chaves privadas, credenciais SMTP, senhas do banco e `JWT_SECRET` nunca devem ser versionados.
- Produção usa valores exclusivos, diferentes dos usados em desenvolvimento.
- Uma credencial publicada deve ser considerada comprometida: primeiro substitua e revogue; depois avalie a limpeza do histórico Git.
- A chave de cliente presente em `google-services.json` é usada para identificar o aplicativo Firebase. Ela deve permanecer limitada às APIs Firebase necessárias e ao aplicativo Android correspondente.

## Verificações automáticas

O GitHub executa Gitleaks no histórico e CodeQL no código TypeScript em pushes, pull requests e semanalmente. O Dependabot acompanha npm, API e GitHub Actions. Alertas não devem ser ignorados sem registrar por que o item é um falso positivo ou não é alcançável no LifeGuard.

## Limitações

O Expo SDK 54 fixa o Metro em uma versão que depende de `image-size@1.2.1`. Essa biblioteca possui alertas de negação de serviço ao analisar formatos ICNS, JXL e HEIF, mas é usada somente no processo local de empacotamento de imagens mantidas no próprio repositório; ela não faz parte do código executado pela API nem recebe arquivos enviados por usuários no aplicativo. As versões corrigidas `2.0.3` e `2.0.4` foram testadas e são incompatíveis com o Metro 0.83.3, impedindo a geração do bundle Android. O projeto mantém a versão compatível de forma explícita, bloqueia novos alertas críticos no CI e deve remover esta exceção quando uma versão compatível do Expo/Metro estiver disponível.

Nenhum scanner prova segurança completa. Antes de uso com pacientes reais, o projeto ainda precisa de teste de intrusão autorizado, revisão da infraestrutura Oracle, política de retenção e acesso aos dados, validação LGPD e avaliação específica do firmware e da comunicação com o ESP32.
