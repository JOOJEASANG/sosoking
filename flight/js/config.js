export const CRAFT = [
  { id: 'falcon', code: 'VF-01', name: '팔콘', call: 'FALCON', role: '균형형 전투기', weapon: '트윈 펄스포', summary: '안정적인 기동과 정밀한 이중 사격.', color: '#78e8ff', tag: '#ffa077', shield: 100, speed: 1.68, handling: '표준', fireInterval: .22, damage: 1.1 },
  { id: 'wraith', code: 'VX-02', name: '레이스', call: 'WRAITH', role: '고속 요격기', weapon: '속사 레이저', summary: '날렵한 선회와 끊임없이 쏟아지는 속사 레이저.', color: '#c69aff', tag: '#d4adff', shield: 78, speed: 2.22, handling: '빠름', fireInterval: .105, damage: 1.02 },
  { id: 'bastion', code: 'HB-03', name: '바스티온', call: 'BASTION', role: '중장갑 공격기', weapon: '삼연장 산탄포', summary: '두터운 장갑과 넓은 사선을 덮는 삼연장 산탄포.', color: '#ffc06d', tag: '#ffc487', shield: 145, speed: 1.31, handling: '느림', fireInterval: .39, damage: 1.65 }
];

export const LEVELS = [
  { id: 'easy', name: '쉬움', note: '성긴 탄막 · 점수 ×0.8', count: 3, hp: .84, tempo: .80, damage: 12, score: .8 },
  { id: 'normal', name: '보통', note: '표준 탄막 · 점수 ×1.0', count: 4, hp: 1, tempo: 1, damage: 17, score: 1 },
  { id: 'hard', name: '어려움', note: '촘촘한 탄막 · 점수 ×1.5', count: 5, hp: 1.18, tempo: 1.23, damage: 21, score: 1.5 }
];

export const SECTORS = ['외곽 궤도', '잔해 지대', '코어 방어선'];
export const PULSE_TIME = 7;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
