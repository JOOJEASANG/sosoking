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
  }
];

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
