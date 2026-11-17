# Identidade visual LifeGuard

Fonte: Brand Book - Life Guard.pdf, fornecido por Mateus em 29/09/2026.

- Azul-marinho: #123B5D (o PDF tem um # duplicado na legenda).
- Azul: #1976A8.
- Turquesa: #35B8C8, em elementos decorativos e áreas com texto escuro.
- Fundo: #F2F5F7; superfície: #FFFFFF; texto: #26343D.
- Títulos Montserrat Bold; controles e subtítulos Montserrat SemiBold;
  textos Montserrat Regular; textos longos Open Sans Regular.
- Slogan: Monitoramento que protege.

As imagens em assets/brand foram extraídas do próprio PDF, respeitando o recorte
do símbolo da página 2. O símbolo não foi redesenhado. O script de extração aceita
o caminho do PDF original e precisa de pypdf e Pillow.

Estados de alerta, atenção e normal continuam com cores semânticas e rótulos.
Não usar turquesa como texto pequeno sobre branco: o contraste é insuficiente.
Novas telas devem importar tokens de src/theme/theme.ts e os componentes comuns.

Em 09/10/2026, elementos da página 3 foram extraídos para assets/brand/elements
pelo script scripts/extract-brand-elements.py. BrandIcon centraliza coração,
cuidado e escudo. PulseLine utiliza o traçado original. SOS e ícones de sinais
vitais usam #1976A8. Cores semânticas de erros e estados clínicos são preservadas.
Por solicitação posterior, LifeGuardIcon fornece sete ícones vetoriais próprios,
inspirados no traço arredondado da marca e nos símbolos funcionais anteriores.
A home usa coração com pulso, termômetro, gráfico, dispositivos, pessoas,
controles de limites e octógono SOS. Traço 1.7 em grade 24, azul #1976A8;
SOS branco sobre azul. São desenhos do aplicativo, não extrações do PDF.

A mudança de ícone e splash exige APK 1.8.0 (versionCode 11). Atualizações JS
compatíveis posteriores podem seguir pelo EAS Update no runtime 1.8.0.
