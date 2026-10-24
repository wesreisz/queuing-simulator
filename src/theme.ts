export const BRAND = {
  talcWhite: '#FFFFFF',
  mistGrey: '#EDF1F3',
  onyxBlack: '#000000',
  waveBlue: '#003D4F',
  flamingoPink: '#F2617A',
  turmericYellow: '#CC850A',
  jadeGreen: '#6B9E78',
  sapphireBlue: '#47A1AD',
  amethystPurple: '#634F7D',
} as const;

export const UI = {
  panel: '#00303E',
  panelDeep: '#002733',
  text: BRAND.mistGrey,
  muted: '#9DB5BD',
  line: 'rgba(237, 241, 243, 0.14)',
  amethystLight: '#9C88B8',
} as const;

export const STAGE_COLORS = {
  dev: BRAND.sapphireBlue,
  review: BRAND.turmericYellow,
  qa: BRAND.jadeGreen,
} as const;
