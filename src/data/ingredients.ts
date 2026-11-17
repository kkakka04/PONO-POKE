export interface Ingredient {
  id: string;
  name: string;
  labelLines?: string[];
  color: string;
  glow?: number;
  image: string;
  unitCal: number; // kcal per portion slot
  description: string;
  tasteTag: string;
}

export const INGREDIENTS: Ingredient[] = [
  {
    id: 'crab',
    name: '맛살',
    color: '#F26B3A',
    image: '/assets/aistudio/crab_bbb6444b.png',
    unitCal: 45,
    description: '달콤 짭조름한 풍미의 게살 맛살',
    tasteTag: '감칠맛 & 단백질',
  },
  {
    id: 'mix',
    name: '채소믹스',
    labelLines: ['채소', '믹스'],
    color: '#7BC043',
    glow: 1,
    image: '/assets/aistudio/mix_13eabe79.png',
    unitCal: 15,
    description: '아삭아삭 신선한 비타민 가득 잎채소',
    tasteTag: '상쾌한 식감',
  },
  {
    id: 'redcabbage',
    name: '적채',
    color: '#8F4FB5',
    image: '/assets/aistudio/redcabbage_72c42a82.png',
    unitCal: 18,
    description: '영양과 색감을 더해주는 자색 양배추',
    tasteTag: '항산화 & 아삭함',
  },
  {
    id: 'onion',
    name: '양파',
    color: '#D4C0A8',
    image: '/assets/aistudio/onion_0e00b0da.png',
    unitCal: 22,
    description: '매운기를 빼고 단맛을 살린 양파 슬라이스',
    tasteTag: '개운한 단맛',
  },
  {
    id: 'corn',
    name: '옥수수',
    color: '#FFD23F',
    image: '/assets/aistudio/corn_fa2b2397.png',
    unitCal: 50,
    description: '입안 가득 톡톡 터지는 스위트콘',
    tasteTag: '달콤한 톡톡',
  },
  {
    id: 'bean',
    name: '콩',
    color: '#C8E25A',
    glow: 1,
    image: '/assets/aistudio/bean_282f975c.png',
    unitCal: 40,
    description: '식물성 단백질이 풍부한 고소한 에다마메',
    tasteTag: '고소한 단백질',
  },
  {
    id: 'seaweed',
    name: '해초샐러드',
    labelLines: ['해초', '샐러드'],
    color: '#2DB68A',
    image: '/assets/aistudio/seaweed_4f52516e.png',
    unitCal: 25,
    description: '바다의 감칠맛을 품은 꼬들꼬들 해초무침',
    tasteTag: '새콤오독 바다향',
  },
];

export const TOTAL_BUDGET = 8;
export const MAX_PORTION = 2;
export const SLOT_GAP = 4; // percentage gap between slots
export const SLOT_HEIGHT = (100 - SLOT_GAP) / 2; // 48%

export function shadeColor(hex: string, amt: number): string {
  const cleanHex = hex.replace('#', '');
  const n = parseInt(cleanHex, 16);
  let r = n >> 16;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const target = amt < 0 ? 0 : 255;
  const a = Math.abs(amt);
  r = Math.round(r + (target - r) * a);
  g = Math.round(g + (target - g) * a);
  b = Math.round(b + (target - b) * a);
  return `rgb(${r}, ${g}, ${b})`;
}
