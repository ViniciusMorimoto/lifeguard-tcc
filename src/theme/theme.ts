export const colors = {
  ink: '#123B5D',
  sand: '#F2F5F7',
  cardBg: '#FFFFFF',
  // Aliases legados preservam a compatibilidade das telas com a nova marca.
  coral: '#1976A8',
  turquoise: '#35B8C8',
  charcoal: '#26343D',
  moss: '#4F7A5B',
  mossBg: '#E1EBDF',
  mossText: '#2F4F38',
  amber: '#D9A441',
  amberBg: '#FBF0DC',
  amberText: '#7A5A17',
  ember: '#C1443C',
  emberBg: '#F7DEDC',
  emberText: '#7A2A24',
  textPrimary: '#26343D',
  textSecondary: '#526675',
  border: 'rgba(18,59,93,0.16)',
  borderStrong: 'rgba(18,59,93,0.3)',
  inkSoft: '#1976A8',
  inkMist: '#E6F2F7',
  sandDeep: '#E5EDF2',
  coralSoft: '#E4F5F7',
  white: '#FFFFFF',
  transparent: 'transparent',
  overlay: 'rgba(18,59,93,0.55)',
  disabled: '#A9B2B0',
};

export const fonts = {
  display: 'Montserrat_700Bold',
  body: 'Montserrat_400Regular',
  bodyBold: 'Montserrat_600SemiBold',
  medium: 'Montserrat_500Medium',
  longText: 'OpenSans_400Regular',
};

export const radii = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 36 };
export const touchTarget = 48;

export const typography = {
  displayLarge: 34,
  displayMedium: 28,
  title: 22,
  body: 16,
  bodySmall: 14,
  caption: 13,
};

export type StatusKey = 'normal' | 'atencao' | 'alerta' | 'sem_sinal';

export const statusConfig: Record<StatusKey, { bg: string; text: string; label: string }> = {
  normal: { bg: colors.mossBg, text: colors.mossText, label: 'Normal' },
  atencao: { bg: colors.amberBg, text: colors.amberText, label: 'Atenção' },
  alerta: { bg: colors.emberBg, text: colors.emberText, label: 'Alerta' },
  sem_sinal: { bg: colors.border, text: colors.textSecondary, label: 'Sem sinal' },
};
