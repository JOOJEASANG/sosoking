import { MULTI_PRESETS } from './presets.js';
import { getRichPlainText } from './editor.js';

const STOP_WORDS = new Set([
  '그리고','그래서','하지만','그러나','이거','저거','그거','오늘','내일','어제','우리','너무','진짜','완전','그냥','하는','해서','하면','하고','입니다','있어요','없어요','해주세요','추천','질문','상황','본문','제목',
  'the','and','for','with','this','that','from','you','your','are','was','were','have','has','will','can'
]);

const PRESET_TAGS = {
  general: ['일반글', '소소킹'],
  vote: ['투표', '밸런스게임', '의견'],
  fill: ['빈칸채우기', '문장놀이', '참여형'],
  naming: ['미친작명소', '작명', '웃긴이름'],
  acrostic: ['삼행시', '제시어', '글짓기'],
  relay: ['막장릴레이', '릴레이소설', '이야기'],
};

function normalizeWord(word) {
  return String(word || '')
    .replace(/^#+/, '')
    .replace(/[^가-힣a-zA-Z0-9_]/g, '')
    .trim();
}

function splitCandidateWords(text) {
  return String(text || '')
    .replace(/#[가-힣a-zA-Z0-9_]+/g, match => ` ${match.slice(1)} `)
    .split(/[\s,./?&!()\[\]{}:;"'“”‘’|\-]+/)
    .map(normalizeWord)
    .filter(word => word.length >= 2 && word.length <= 18)
    .filter(word => !STOP_WORDS.has(word));
}

function scoreWords(words) {
  const scores = new Map();
  words.forEach((word, index) => {
    const base = index < 12 ? 3 : 1;
    const bonus = /[가-힣]/.test(word) && word.length <= 8 ? 1 : 0;
    scores.set(word, (scores.get(word) || 0) + base + bonus);
  });
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([word]) => word);
}

function uniqueTags(tags) {
  const seen = new Set();
  return tags
    .map(normalizeWord)
    .filter(Boolean)
    .filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

export function generateAutoTags({ title = '', body = '', presetKey = 'general', extra = '' } = {}) {
  const preset = MULTI_PRESETS[presetKey] || MULTI_PRESETS.general;
  const presetTags = PRESET_TAGS[presetKey] || PRESET_TAGS.general;
  const words = scoreWords(splitCandidateWords(`${title} ${title} ${body} ${extra}`));
  return uniqueTags([...presetTags, preset.label, ...words]);
}

export function fillAutoTags({ force = false } = {}) {
  const input = document.getElementById('mw-tags');
  if (!input) return [];
  if (!force && input.value.trim()) return input.value.split(',').map(v => v.trim()).filter(Boolean);

  const title = document.getElementById('mw-title')?.value || '';
  const body = getRichPlainText();
  const presetKey = document.querySelector('.multi-write-page')?.dataset.presetKey || 'general';
  const extra = document.getElementById('mw-acrostic-keyword')?.value || '';
  const tags = generateAutoTags({ title, body, presetKey, extra });
  input.value = tags.join(', ');
  return tags;
}
