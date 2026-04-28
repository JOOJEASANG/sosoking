export async function renderSosoNews(container, newsId) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">📺 소소뉴스</span>
      </div>
      <div class="container" style="padding-top:60px;padding-bottom:80px;text-align:center;">
        <div style="font-size:64px;margin-bottom:20px;">📺</div>
        <div style="font-family:var(--font-serif);font-size:22px;font-weight:700;color:var(--news);margin-bottom:10px;">소소뉴스</div>
        <div style="font-size:15px;color:var(--text-dim);line-height:1.7;margin-bottom:32px;">
          오늘 있었던 아주 사소한 사건을<br>CNN·MBC가 긴급 보도합니다 📡<br><br>
          <span style="color:var(--text-dim);font-size:13px;">🚧 곧 오픈 예정입니다!</span>
        </div>
        <a href="#/" class="btn btn-primary" style="max-width:240px;">← 홈으로</a>
      </div>
    </div>
  `;
}
