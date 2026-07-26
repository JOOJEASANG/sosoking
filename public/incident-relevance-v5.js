(() => {
  "use strict";

  const nativeFetch = window.fetch.bind(window);
  const stopwords = new Set([
    "내", "내가", "나는", "우리", "제가", "저는", "그냥", "진짜", "너무", "조금", "약간", "정말", "오늘", "어제", "또", "자꾸",
    "친구", "동생", "형", "누나", "언니", "오빠", "가족", "엄마", "아빠", "회사", "집", "사람", "누가", "말없이", "몰래", "갑자기",
    "했다", "했는데", "했지만", "있었다", "없었다", "됐다", "먹었다", "샀다", "늦었다", "남았다", "사라졌다", "가져갔다", "보냈다"
  ]);
  const suffixes = [
    "으로부터", "에게서", "한테서", "에서는", "으로는", "까지는", "부터는", "에게는", "한테는", "이라도", "라도", "으로", "에서",
    "에게", "한테", "처럼", "보다", "까지", "부터", "께서", "하고", "이며", "에도", "만", "은", "는", "이", "가", "을", "를", "의", "에", "도", "와", "과", "로"
  ].sort((a, b) => b.length - a.length);

  function normalize(value) {
    return String(value || "").replace(/[\s.,!?"'“”‘’()[\]{}:;·-]/g, "").toLowerCase();
  }

  function stem(raw) {
    let token = String(raw || "").replace(/[^0-9A-Za-z가-힣]/g, "");
    if (token.length < 2) return "";
    for (const suffix of suffixes) {
      if (token.endsWith(suffix) && token.length - suffix.length >= 2) {
        token = token.slice(0, -suffix.length);
        break;
      }
    }
    if (/(했다|했는데|했지만|있었다|없었다|됐다|먹었다|샀다|늦었다|남았다|사라졌다|가져갔다|돌려줬다|보냈다|읽었다|말했다|넣어둔|꺼냈다)$/.test(token)) return "";
    return token;
  }

  function anchors(incident) {
    const raw = String(incident || "").split(/\s+/).map(stem).filter(Boolean);
    const preferred = raw.filter((token) => !stopwords.has(token));
    const pool = preferred.length >= 2 ? preferred : raw;
    return [...new Set(pool)]
      .sort((a, b) => Number(/\d/.test(b)) - Number(/\d/.test(a)) || b.length - a.length)
      .slice(0, 5);
  }

  function hasAnchor(value, list) {
    const text = normalize(typeof value === "string" ? value : JSON.stringify(value || ""));
    return list.some((anchor) => text.includes(normalize(anchor)));
  }

  function isRelevant(courtCase, incident) {
    const list = anchors(incident);
    if (!list.length || !courtCase) return true;
    return hasAnchor(courtCase.title, list)
      && hasAnchor(courtCase.summary, list)
      && hasAnchor(courtCase.evidence, list)
      && hasAnchor(courtCase.forensicReports, list)
      && hasAnchor(courtCase.questions, list)
      && hasAnchor(courtCase.briefing, list)
      && hasAnchor(courtCase.verdicts, list);
  }

  function makeFallback(incident) {
    const list = anchors(incident);
    const primary = list[0] || "접수 물건";
    const secondary = list[1] || "문제 행동";
    const subject = list.slice(0, 3).join("·") || String(incident).replace(/[.!?]/g, "").slice(0, 18);
    const quoted = `“${incident}”`;
    return {
      title: `${subject} 생활질서 과잉수사 사건`,
      subtitle: `${primary}와 ${secondary} 사이의 사소하지만 지나치게 기록된 분쟁`,
      charge: `${primary} 관련 기대질서 교란 및 ${secondary} 처리절차 무단변경`,
      summary: `${quoted}라는 제보가 접수됐다. 생활질서 특수본은 ${primary}와 ${secondary}의 관계를 단순 해프닝이 아닌 장기 추적이 필요한 생활질서 사건으로 확대했다.`,
      damages: `${primary} 관련 기대감 73%, 평온함 2칸, 설명 시간 11분`,
      commandCenter: `${primary} 전담 임시 합동상황실`,
      operationName: `작전명: ${primary}를 끝까지 기억하라`,
      emergencyGrade: `${subject} 생활질서 위기 2단계`,
      scale: `${primary} 전담 현장요원 14명·장비 9종`,
      impact: `${primary} 확인을 위한 대화 증가 및 ${secondary} 관련 회의 2회 개최`,
      taskForceUnits: [`${primary} 위치추적반`, `${secondary} 시간대 분석반`, `${primary} 미세흔적 감식반`, `${subject} 긴급브리핑반`],
      dispatchLog: [
        { time: "14:03", unit: `${primary} 초동반`, action: `${primary} 주변 반경 1.2m 통제`, note: "통제선이 사건 물건보다 훨씬 커졌다." },
        { time: "14:07", unit: `${secondary} 기록반`, action: `${quoted} 원문을 상황판 중앙에 부착`, note: "다른 사건 자료와 섞지 말라는 지시가 세 번 내려왔다." },
        { time: "14:12", unit: `${primary} 보존반`, action: `${primary} 관련 물품만 증거 후보 지정`, note: "관련 없는 티백은 이번에는 돌려보냈다." },
        { time: "14:18", unit: "상황실", action: `${subject} 사건명 최종 확정`, note: "최종 명칭에도 접수 소재가 그대로 남았다." }
      ],
      surveillance: {
        location: `${primary}가 마지막으로 확인된 장소 바로 옆`, duration: "1시간 47분",
        disguise: `${primary}에 관심 없는 척하지만 계속 확인하는 사람`,
        observation: `${secondary}와 관련된 움직임을 세 차례 관찰했으나 모두 지나치게 평범했다.`,
        unexpected: `잠복요원이 ${primary} 보관 위치를 정리하다 별도 정리정돈 표창 후보가 됐다.`
      },
      forensicReports: [
        { sample: `${primary} 표면 또는 잔여 흔적`, method: "48배 확대 및 방향성 측정", finding: `${primary}가 사건 전보다 오른쪽으로 3.4cm 이동했을 가능성`, unnecessaryConclusion: `${primary}는 오른쪽 이동을 선호하는 성향일 수 있다.` },
        { sample: `${secondary} 발생 지점`, method: "시간대별 반사광 비교", finding: `${secondary} 직전과 직후 밝기가 미세하게 달라짐`, unnecessaryConclusion: "조명도 사건을 지켜봤지만 진술 의사는 없다." },
        { sample: `${primary} 주변 공용 도구`, method: "진동 잔향 대조", finding: `${primary}와 접촉했을 가능성이 있는 도구 한 개 확인`, unnecessaryConclusion: "도구는 사건보다 오래 근무한 것으로 보인다." }
      ],
      search: {
        warrant: `${subject} 생활질서 임시확인서 제4호`,
        target: `${primary} 보관 장소와 ${secondary} 발생 지점 주변 80cm`,
        seizedItems: [`${primary} 관련 포장 또는 기록`, `${secondary} 시간대 메모`, `${primary}와 크기가 맞지 않는 공용 도구`],
        officerNote: `압수품 모두 ${primary} 또는 ${secondary}와 최소 한 번은 관련이 있다고 주장하고 있다.`
      },
      evidence: [
        { label: "증거 A", title: `${primary} 현장 상태`, detail: `${quoted} 제보와 비교할 수 있도록 ${primary}의 현재 상태를 기록했다.`, significance: `${primary}가 실제 사건의 중심이라는 가장 직접적인 자료다.` },
        { label: "증거 B", title: `${secondary} 시간대 기록`, detail: `${secondary}가 발생한 전후의 움직임을 분 단위로 확대했다.`, significance: "실제로는 짧은 시간이지만 수사본부는 타임라인 세 장을 만들었다." },
        { label: "증거 C", title: `${primary} 주변 도구`, detail: `${primary}와 접촉했을 가능성이 있는 물건을 전부 줄 세웠다.`, significance: "도구 수가 용의자 수보다 많아 수사가 잠시 정체됐다." },
        { label: "증거 D", title: `${subject} 제보 원문`, detail: quoted, significance: "수사 방향이 다른 사건으로 새지 않도록 상황판 중앙에 고정한 핵심 기록이다." }
      ],
      questions: [
        { question: `${primary}의 상태가 달라진 이유를 설명할 수 있습니까?`, speaker: "피고", response: `${primary}를 보기는 했지만 그렇게 중요해질 줄은 몰랐습니다.`, replySpeaker: "신문관", reply: "중요하지 않았다는 진술 때문에 전담반이 한 팀 더 늘었습니다." },
        { question: `${secondary}가 발생한 정확한 시각은 언제입니까?`, speaker: "피고", response: "정확한 분까지는 기억하지 못합니다.", replySpeaker: "검사", reply: "기억하지 못한 1분을 확인하기 위해 CCTV 없는 구역까지 분석하겠습니다." },
        { question: `${primary}와 관련된 후속 조치를 왜 하지 않았습니까?`, speaker: "피고", response: "곧 설명하려고 했습니다.", replySpeaker: "재판장", reply: "곧이라는 표현의 평균 길이를 별도 감정합니다." }
      ],
      briefing: {
        headline: `${subject} 사건, ${primary}와 ${secondary} 연관성 중심으로 수사 확대`,
        spokesperson: "생활질서 특수본 대변인",
        statement: `${quoted} 제보의 사실관계를 유지한 채 ${primary} 상태와 ${secondary} 경위를 집중 확인하고 있습니다.`,
        reporterQuestion: `${primary} 하나 때문에 브리핑 마이크 7개가 꼭 필요합니까?`,
        answer: `${primary}는 하나지만 마이크는 기관별 입장을 반영해야 한다는 결론입니다.`
      },
      prosecution: `${primary}와 ${secondary}에 관한 제보가 명확하며, 피고의 설명은 사건보다 짧고 수사보고서는 사건보다 길어졌습니다.`,
      defense: `${primary}의 상태 변화와 ${secondary} 사이에 직접적인 인과관계는 아직 통제선 길이만큼 명확하지 않습니다.`,
      judge: `${primary}와 ${secondary}가 이 사건의 핵심이라는 점은 분명합니다. 다만 사건보다 수사 규모가 커진 책임도 판결에 반영하겠습니다.`,
      verdicts: [
        { title: `${primary} 공개 복구형`, sentence: `피고는 ${primary}를 원래 상태로 복구하거나 같은 종류 3개를 배상하고, ${secondary} 경위를 30초 안에 설명한다.`, afterStory: `${primary} 3개의 소유권을 두고 새로운 이름표 분쟁이 발생했다.` },
        { title: `${secondary} 재발방지 기록형`, sentence: `관련자 전원은 일주일간 ${secondary}와 비슷한 행동이 발생할 때마다 ${primary} 전담대장에 기록한다.`, afterStory: `대장 작성 시간이 ${secondary}보다 길어져 기록 간소화 사건이 새로 접수됐다.` },
        { title: `${subject} 황당 화해형`, sentence: `피고와 피해자는 ${primary} 앞에서 ${secondary}에 대해 각각 20초씩 공식 사과한 뒤 간식을 함께 나눈다.`, afterStory: "간식의 마지막 한 조각을 누가 먹을지 결정하지 못해 긴급 재심이 열렸다." }
      ],
      judgeTypes: [`${primary} 집중감식형 재판관`, `${secondary} 시간대 추적형 판사`, `${subject} 황당화해 전문 조정관`]
    };
  }

  function responseFor(courtCase, source, anchorsList) {
    return new Response(JSON.stringify({
      case: courtCase,
      meta: { source, version: "incident-relevance-v5", anchors: anchorsList }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : String(input?.url || "");
    if (!url.includes("/api/generate-case")) return nativeFetch(input, init);
    let incident = "";
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      incident = String(body.incident || "").trim();
    } catch {
      return nativeFetch(input, init);
    }
    try {
      const response = await nativeFetch(input, init);
      const payload = await response.clone().json().catch(() => ({}));
      if (response.ok && payload.case && isRelevant(payload.case, incident)) return response;
      console.warn("접수 내용 관련성이 낮은 AI 기록을 접수문 기반 기록으로 교체합니다.", payload?.meta || payload?.error || response.status);
      return responseFor(makeFallback(incident), "incident-fallback", anchors(incident));
    } catch (error) {
      console.warn("AI 요청 실패로 접수문 기반 기록을 사용합니다.", error);
      return responseFor(makeFallback(incident), "incident-fallback", anchors(incident));
    }
  };
})();