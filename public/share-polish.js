(() => {
  "use strict";

  const stageContent = document.querySelector("#stage-content");
  const caseNumber = document.querySelector("#case-number");
  if (!stageContent) return;

  let rememberedTitle = "";
  let busy = false;
  const clean = (value, fallback = "") => String(value || "").replace(/\s+/g, " ").trim() || fallback;

  function rememberOpeningTitle() {
    const title = stageContent.querySelector(".dossier-topline + h2")?.textContent;
    if (title) rememberedTitle = clean(title);
  }

  new MutationObserver(rememberOpeningTitle).observe(stageContent, { childList: true, subtree: true });
  rememberOpeningTitle();

  function resultData() {
    const result = stageContent.querySelector(".result-banner");
    const afterStory = stageContent.querySelector(".after-story p");
    const judgeLines = [...stageContent.querySelectorAll(".judge-line")];
    const judgeType = judgeLines.at(-1)?.textContent?.replace("당신의 판결 성향", "");
    const order = result?.querySelector("h3")?.textContent?.replace(/^주문:\s*/, "");
    const sentence = result?.querySelector("p strong")?.textContent;
    if (!result || !order || !sentence) return null;
    return {
      title: rememberedTitle || "사소한 일상질서 과잉 재판 사건",
      order: clean(order),
      sentence: clean(sentence),
      afterStory: clean(afterStory?.textContent, "판결 집행 과정에서 더 사소한 후속 분쟁이 접수됐다."),
      judgeType: clean(judgeType, "사소한 일을 끝까지 책임지는 생활밀착형 재판관"),
      number: clean(caseNumber?.textContent?.split("·")[0], "소문난 판결소 최종 판결")
    };
  }

  function lineBreaks(ctx, text, maxWidth, maxLines = 8) {
    const chars = [...clean(text)];
    const lines = [];
    let line = "";
    for (const char of chars) {
      const candidate = line + char;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = char;
        if (lines.length >= maxLines) break;
      } else {
        line = candidate;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    const used = lines.join("").length;
    if (used < chars.length && lines.length) lines[lines.length - 1] = `${lines.at(-1).slice(0, -1)}…`;
    return lines;
  }

  function drawLines(ctx, lines, x, y, lineHeight) {
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  }

  function drawStamp(ctx, x, y, text, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.strokeStyle = "#c93430";
    ctx.fillStyle = "#c93430";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 39, 0, Math.PI * 2);
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '900 48px Georgia, "Noto Serif KR", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 2);
    ctx.restore();
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지 생성 실패")), "image/png", 0.95);
    });
  }

  async function createCard(data) {
    if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 기능을 사용할 수 없습니다.");

    canvas.width = 1080;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.font = '900 56px Georgia, "Noto Serif KR", serif';
    const titleLines = lineBreaks(ctx, data.title, 876, 4);
    ctx.font = '900 48px Georgia, "Noto Serif KR", serif';
    const orderLines = lineBreaks(ctx, data.order, 876, 3);
    ctx.font = '700 32px "Noto Sans KR", sans-serif';
    const sentenceLines = lineBreaks(ctx, data.sentence, 876, 5);
    ctx.font = '600 27px "Noto Sans KR", sans-serif';
    const storyLines = lineBreaks(ctx, data.afterStory, 808, 5);
    const judgeLines = lineBreaks(ctx, data.judgeType, 876, 4);

    const contentHeight = 226 + 110 + titleLines.length * 72 + 90 + orderLines.length * 62 + 44 + sentenceLines.length * 50 + 80 + 74 + storyLines.length * 39 + 74 + judgeLines.length * 40 + 176;
    canvas.height = Math.max(1350, Math.min(1780, contentHeight));

    ctx.fillStyle = "#f6f0e4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#13203a";
    ctx.fillRect(0, 0, canvas.width, 226);
    ctx.strokeStyle = "#d6c8b2";
    ctx.lineWidth = 3;
    ctx.strokeRect(54, 54, 972, canvas.height - 108);

    ctx.fillStyle = "rgba(189,138,45,0.13)";
    ctx.beginPath();
    ctx.arc(930, canvas.height - 310, 250, 0, Math.PI * 2);
    ctx.fill();

    drawStamp(ctx, 116, 112, "소", -0.08);
    drawStamp(ctx, 964, 112, "소", 0.08);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = '800 56px Georgia, "Noto Serif KR", serif';
    ctx.fillText("문난 판결", 540, 128);
    ctx.font = '700 23px "Noto Sans KR", sans-serif';
    ctx.fillStyle = "#d9c79f";
    ctx.fillText("사소한 일상 전문 대형사건 처리기관", 540, 177);

    ctx.textAlign = "left";
    ctx.fillStyle = "#c93430";
    ctx.font = '800 25px "Noto Sans KR", sans-serif';
    ctx.fillText("최종 판결문", 102, 298);
    ctx.fillStyle = "#13203a";
    ctx.font = '900 56px Georgia, "Noto Serif KR", serif';
    let y = drawLines(ctx, titleLines, 102, 370, 72) + 42;

    ctx.strokeStyle = "#c93430";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(102, y);
    ctx.lineTo(978, y);
    ctx.stroke();
    y += 70;

    ctx.fillStyle = "#6f675b";
    ctx.font = '800 24px "Noto Sans KR", sans-serif';
    ctx.fillText("주문", 102, y);
    y += 58;
    ctx.fillStyle = "#c93430";
    ctx.font = '900 48px Georgia, "Noto Serif KR", serif';
    y = drawLines(ctx, orderLines, 102, y, 62) + 36;

    ctx.fillStyle = "#13203a";
    ctx.font = '700 32px "Noto Sans KR", sans-serif';
    y = drawLines(ctx, sentenceLines, 102, y, 50) + 54;

    const storyHeight = 84 + storyLines.length * 39;
    ctx.fillStyle = "#efe5d3";
    ctx.fillRect(102, y, 876, storyHeight);
    ctx.fillStyle = "#6f675b";
    ctx.font = '800 22px "Noto Sans KR", sans-serif';
    ctx.fillText("판결 집행 후 긴급 속보", 136, y + 42);
    ctx.fillStyle = "#29251f";
    ctx.font = '600 27px "Noto Sans KR", sans-serif';
    drawLines(ctx, storyLines, 136, y + 82, 39);
    y += storyHeight + 58;

    ctx.fillStyle = "#13203a";
    ctx.font = '800 22px "Noto Sans KR", sans-serif';
    ctx.fillText("당신의 판결 성향", 102, y);
    ctx.fillStyle = "#6f675b";
    ctx.font = '600 27px "Noto Sans KR", sans-serif';
    drawLines(ctx, judgeLines, 102, y + 46, 40);

    const footerY = canvas.height - 158;
    ctx.fillStyle = "#13203a";
    ctx.fillRect(54, footerY, 972, 104);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = '800 25px "Noto Sans KR", sans-serif';
    ctx.fillText("별일 아니지만, 일단 재판부터 열겠습니다.", 540, footerY + 42);
    ctx.fillStyle = "#d9c79f";
    ctx.font = '700 21px "Noto Sans KR", sans-serif';
    ctx.fillText("sosoking.co.kr · 오락용 가상 판결", 540, footerY + 80);

    return canvasBlob(canvas);
  }

  function status(message, error = false) {
    const element = stageContent.querySelector("[data-share-status]");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", error);
  }

  function setBusy(active) {
    busy = active;
    stageContent.querySelectorAll("[data-share-action]").forEach((button) => {
      button.disabled = active;
      button.setAttribute("aria-busy", String(active));
    });
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    if (!copied) throw new Error("복사 실패");
  }

  async function download(data) {
    const blob = await createCard(data);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `소문난-판결소-${data.number.replace(/[^0-9A-Za-z가-힣-]/g, "-")}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    status("판결 결과 카드를 이미지로 저장했습니다.");
  }

  async function share(data) {
    const blob = await createCard(data);
    const file = new File([blob], "소문난-판결소-판결문.png", { type: "image/png" });
    const text = `소문난 판결소\n${data.title}\n판결: ${data.order}\n형벌: ${data.sentence}`;
    const url = location.hostname.includes("web.app") || location.hostname.includes("firebaseapp.com") ? location.href : "https://sosoking.co.kr";
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "소문난 판결소 판결문", text, url, files: [file] });
      status("판결문 공유 창을 열었습니다.");
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "소문난 판결소 판결문", text, url });
      status("판결 결과를 공유했습니다.");
      return;
    }
    const shareText = `${text}\n${url}`;
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareText);
    else fallbackCopy(shareText);
    status("공유 문구를 복사했습니다. 원하는 대화방에 붙여넣으세요.");
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-share-action]");
    if (!button || !stageContent.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    const data = resultData();
    if (!data) {
      status("확정된 판결 정보를 찾지 못했습니다.", true);
      return;
    }
    setBusy(true);
    status("판결문을 정리하고 있습니다.");
    try {
      if (button.dataset.shareAction === "download") await download(data);
      else await share(data);
    } catch (error) {
      if (error?.name === "AbortError") status("공유가 취소됐습니다.");
      else status("공유 카드를 만들지 못했습니다. 다시 시도해주세요.", true);
      console.error("enhanced share failed", error);
    } finally {
      setBusy(false);
    }
  }, true);
})();
