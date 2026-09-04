const PII_PATTERNS = [
  {
    code: 'resident-id',
    pattern: /\b\d{6}\s*[- ]\s*[1-8]\d{6}\b/,
    message: '주민등록번호 등 개인 식별번호는 입력할 수 없습니다.'
  },
  {
    code: 'phone',
    pattern: /(?:^|[^\d])(?:01[016789]|02|0[3-6][1-5])[- .]?\d{3,4}[- .]?\d{4}(?:[^\d]|$)/,
    message: '전화번호는 입력할 수 없습니다.'
  },
  {
    code: 'email',
    pattern: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
    message: '이메일 주소는 입력할 수 없습니다.'
  },
  {
    code: 'payment-card',
    pattern: /(?:^|[^\d])(?:\d[ -]?){15,16}(?:[^\d]|$)/,
    message: '카드번호로 보이는 숫자는 입력할 수 없습니다.'
  },
  {
    code: 'bank-account',
    pattern: /(?:계좌|은행|입금|송금)[^\n]{0,18}\d{2,6}[- ]\d{2,6}(?:[- ]\d{2,7}){1,3}/i,
    message: '계좌번호는 입력할 수 없습니다.'
  },
  {
    code: 'address',
    pattern: /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{0,35}(?:로|길|동)\s*\d{1,4}(?:-\d{1,4})?/,
    message: '상세 주소는 입력할 수 없습니다.'
  },
  {
    code: 'person-name-labeled',
    pattern: /(?:성명|실명|이름|본명|피해자|가해자|원고|피고)\s*[:：]\s*[가-힣]{2,4}(?=\s|$|[,.!?])/,
    message: '실명으로 보이는 이름은 입력하지 말아 주세요.'
  }
];

const HONORIFIC_NAME_PATTERN = /(?:^|\s)([가-힣]{2,4})\s*(씨|님|군|양)(?:은|는|이|가|을|를|에게|께서|와|과|도|의)?(?=\s|$|[,.!?])/g;

// '님'은 사람 이름뿐 아니라 직책·관계 호칭에 매우 자주 붙는다.
// 아래 일반 호칭은 실명으로 오인하지 않고 허용한다.
const COMMON_NIM_STEMS = new Set([
  '사장', '점장', '원장', '회장', '대표', '이사', '과장', '부장', '팀장', '실장', '대리', '주임',
  '선생', '교수', '교장', '교감', '강사', '코치', '감독', '기사', '의사', '간호사', '약사', '변호사',
  '판사', '검사', '경찰', '경찰관', '공무원', '직원', '매니저', '담당자', '관리자', '고객', '회원',
  '주인', '손님', '부모', '아버', '어머', '장인', '장모', '사모', '목사', '신부', '스님', '선배', '후배',
  '친구', '독자', '작가', '하느', '하나', '부처'
]);

// '씨'가 사람 이름이 아닌 단어 일부인 대표적인 경우.
const COMMON_SSI_STEMS = new Set(['아저', '아가']);

function hasLikelyPersonalNameHonorific(text) {
  for (const match of text.matchAll(HONORIFIC_NAME_PATTERN)) {
    const stem = match[1];
    const honorific = match[2];
    if (honorific === '님' && COMMON_NIM_STEMS.has(stem)) continue;
    if (honorific === '씨' && COMMON_SSI_STEMS.has(stem)) continue;
    return true;
  }
  return false;
}

const HIGH_RISK_PATTERNS = [
  {
    code: 'self-harm',
    pattern: /자살|자해|죽고\s*싶|극단적\s*선택|목숨을\s*끊/i
  },
  {
    code: 'sexual-violence',
    pattern: /성폭력|성추행|강간|강제추행|아동\s*성착취|불법\s*촬영/i
  },
  {
    code: 'violent-crime',
    pattern: /살인|살해|칼로\s*(?:찌르|찔)|폭행|상해|납치|감금|흉기|방화/i
  },
  {
    code: 'abuse-threat',
    pattern: /아동학대|가정폭력|학교폭력|스토킹|협박|보복\s*하겠/i
  },
  {
    code: 'serious-crime',
    pattern: /절도|강도|사기(?:를\s*당|당했|쳤)|돈을\s*훔|마약|도박\s*빚/i
  }
];

const PROMPT_ATTACK_PATTERNS = [
  /이전.{0,20}지시.{0,12}무시/i,
  /시스템.{0,12}프롬프트/i,
  /개발자.{0,12}(?:메시지|지시)/i,
  /(?:규칙|안전\s*정책).{0,12}(?:무시|우회)/i,
  /ignore\s+(?:all\s+)?previous\s+instructions?/i,
  /\bjailbreak\b/i
];

function normalizedText(value) {
  return String(value || '').normalize('NFKC').replace(/\u0000/g, '').trim();
}

function inspectContent(value, { allowHighRisk = false } = {}) {
  const text = normalizedText(value);
  if (!text) return { safe: true, code: '', message: '' };

  for (const item of PII_PATTERNS) {
    if (item.pattern.test(text)) {
      return { safe: false, category: 'pii', code: item.code, message: item.message };
    }
  }

  if (hasLikelyPersonalNameHonorific(text)) {
    return {
      safe: false,
      category: 'pii',
      code: 'person-name-honorific',
      message: '실명으로 보이는 이름은 입력하지 말아 주세요.'
    };
  }

  if (PROMPT_ATTACK_PATTERNS.some(pattern => pattern.test(text))) {
    return {
      safe: false,
      category: 'prompt-attack',
      code: 'instruction-bypass',
      message: '시스템 지시를 변경하거나 공개하도록 요구하는 내용은 입력할 수 없습니다.'
    };
  }

  if (!allowHighRisk) {
    const highRisk = HIGH_RISK_PATTERNS.find(item => item.pattern.test(text));
    if (highRisk) {
      return {
        safe: false,
        category: 'high-risk',
        code: highRisk.code,
        message: '실제 범죄·폭력·위기 사건은 오락용 AI 판결로 처리할 수 없습니다. 관계 기관이나 전문가의 도움을 이용해 주세요.'
      };
    }
  }

  return { safe: true, code: '', message: '' };
}

module.exports = {
  inspectContent
};
