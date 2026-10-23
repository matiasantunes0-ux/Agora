// Agora color palette — black & green
export const colors = {
  primary: '#22C55E', // main Agora green
  primaryDark: '#000000', // top bars / banner
  primaryLight: '#0E2418', // dark green tint for chips and selected states
  onPrimary: '#03140A', // text/icons drawn on top of the green
  white: '#FFFFFF',
  background: '#0A0D0B',
  surface: '#121714', // cards
  text: '#ECF3EE',
  textMuted: '#8A9C91',
  border: '#1F2A23',

  // Market colors — always shown with an arrow/sign, never color alone
  gain: '#34D27B',
  gainBg: '#0E2418',
  loss: '#F26D6D',
  lossBg: '#2B1315',

  // Chart series (validated for colorblind separation on the dark surface)
  series: ['#3987E5', '#D95926'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

// Keeps digits the same width so numbers line up like a terminal
export const numeric = { fontVariant: ['tabular-nums'] };
