import fs from 'node:fs';

function patch(file, replacements) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [before, after] of replacements) {
    if (!source.includes(before)) {
      throw new Error(`${file}: patch target missing: ${before.slice(0, 120)}`);
    }
    source = source.replace(before, after);
  }
  fs.writeFileSync(file, source);
}

patch('public/js/app.js', [
  [
    '<button type="button" class="btn btn-primary" onclick="location.reload()">새로고침</button>',
    '<button type="button" class="btn btn-primary" id="route-reload-btn">새로고침</button>'
  ],
  [
    '        <a href="#/" class="btn btn-ghost" style="margin-top:10px;">홈으로 이동</a>\n      </div>\n    </div>`;\n}',
    '        <a href="#/" class="btn btn-ghost" style="margin-top:10px;">홈으로 이동</a>\n      </div>\n    </div>`;\n  content.querySelector(\'#route-reload-btn\')?.addEventListener(\'click\', () => location.reload());\n}'
  ]
]);

patch('public/js/pages/home.js', [
  [
    `          <div class="judge-card" onclick="location.hash='#/submit'">\n            <div class="judge-card-icon">🎲</div>\n            <div class="judge-card-name">운명에 맡기기</div>\n            <div class="judge-card-desc" style="color:var(--gold);">서버가 점지합니다</div>\n          </div>`,
    `          <a href="#/submit" class="judge-card" style="text-decoration:none;color:inherit;">\n            <div class="judge-card-icon">🎲</div>\n            <div class="judge-card-name">운명에 맡기기</div>\n            <div class="judge-card-desc" style="color:var(--gold);">서버가 점지합니다</div>\n          </a>`
  ],
  [
    `            <div class="judge-card" onclick="location.hash='#/submit'">\n              <div class="judge-card-icon">\${j.icon}</div>\n              <div class="judge-card-name">\${escapeHtml(j.name)}</div>\n              <div class="judge-card-desc">\${escapeHtml(j.desc)}</div>\n            </div>`,
    `            <a href="#/submit" class="judge-card" style="text-decoration:none;color:inherit;">\n              <div class="judge-card-icon">\${j.icon}</div>\n              <div class="judge-card-name">\${escapeHtml(j.name)}</div>\n              <div class="judge-card-desc">\${escapeHtml(j.desc)}</div>\n            </a>`
  ]
]);

patch('public/js/pages/home-court.js', [
  [
    `  container.querySelectorAll('.judge-card').forEach(card => {\n    card.setAttribute('role', 'link');\n    card.setAttribute('tabindex', '0');\n    card.addEventListener('keydown', event => {`,
    `  container.querySelectorAll('.judge-card').forEach(card => {\n    if (card.matches('a,button')) return;\n    card.setAttribute('role', 'link');\n    card.setAttribute('tabindex', '0');\n    card.addEventListener('keydown', event => {`
  ]
]);

patch('public/js/pages/board.js', [
  [
    `  return \`<div class="card board-featured-card" onclick="location.hash='#/result/\${encodeURIComponent(id)}'" style="padding:20px;margin-bottom:16px;cursor:pointer;border-color:rgba(201,168,76,.65);background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(255,255,255,.03));">`,
    `  return \`<a href="#/result/\${encodeURIComponent(id)}" class="card board-featured-card" style="display:block;padding:20px;margin-bottom:16px;cursor:pointer;border-color:rgba(201,168,76,.65);background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(255,255,255,.03));color:inherit;text-decoration:none;">`
  ],
  [
    `    <div style="margin-top:10px;text-align:right;font-size:12px;color:var(--cream-dim);">🧑‍⚖️ \${totalVotes(r)}표 · 💬 \${totalComments(r)}</div>\n  </div>\`;`,
    `    <div style="margin-top:10px;text-align:right;font-size:12px;color:var(--cream-dim);">🧑‍⚖️ \${totalVotes(r)}표 · 💬 \${totalComments(r)}</div>\n  </a>\`;`
  ],
  [
    `  return \`<div class="card" onclick="location.hash='#/result/\${encodeURIComponent(id)}'" style="padding:16px 18px;cursor:pointer;">`,
    `  return \`<a href="#/result/\${encodeURIComponent(id)}" class="card" style="display:block;padding:16px 18px;cursor:pointer;color:inherit;text-decoration:none;">`
  ],
  [
    `      <span style="color:var(--gold);white-space:nowrap;">🧑‍⚖️ \${totalVotes(r)} · 💬 \${totalComments(r)} →</span>\n    </div>\n  </div>\`;`,
    `      <span style="color:var(--gold);white-space:nowrap;">🧑‍⚖️ \${totalVotes(r)} · 💬 \${totalComments(r)} →</span>\n    </div>\n  </a>\`;`
  ]
]);

patch('public/admin/admin.js', [
  [
    "    return byEmail.exists() || email === 'sosoday1976@gmail.com';",
    '    return byEmail.exists();'
  ],
  [
    '<button onclick="window._logout()" style="background:none;border:none;color:var(--cream-dim);font-size:12px;cursor:pointer;">로그아웃</button>',
    '<button type="button" id="admin-logout" style="background:none;border:none;color:var(--cream-dim);font-size:12px;cursor:pointer;">로그아웃</button>'
  ],
  [
    `<div class="admin-nav">\${tabs.map(([id,label]) => \`<button class="admin-tab\${currentTab === id ? ' active' : ''}" onclick="window._tab('\${id}')">\${label}</button>\`).join('')}</div>`,
    `<div class="admin-nav">\${tabs.map(([id,label]) => \`<button type="button" class="admin-tab\${currentTab === id ? ' active' : ''}" data-admin-tab="\${escapeAttr(id)}">\${escapeHtml(label)}</button>\`).join('')}</div>`
  ],
  [
    `  window._logout = async () => signOut(auth);\n  window._tab = tab => { currentTab = tab; renderDashboard(); };\n  loadTab(currentTab);`,
    `  window._logout = async () => signOut(auth);\n  window._tab = tab => { currentTab = tab; renderDashboard(); };\n  document.getElementById('admin-logout')?.addEventListener('click', () => window._logout());\n  document.querySelectorAll('[data-admin-tab]').forEach(button => {\n    button.addEventListener('click', () => window._tab(button.dataset.adminTab));\n  });\n  loadTab(currentTab);`
  ],
  [
    `<td><div class="admin-actions"><button class="admin-btn gold" onclick="location.href='/#/result/\${escapeAttr(d.id)}'">보기</button><button class="admin-btn" onclick="window._recordPublic('\${escapeAttr(d.id)}', \${!isPublic})">\${isPublic ? '비공개' : '공개'}</button><button class="admin-btn red" onclick="window._delRecord('\${escapeAttr(d.id)}')">삭제</button></div></td>`,
    `<td><div class="admin-actions"><button type="button" class="admin-btn gold" data-record-action="view" data-case-id="\${escapeAttr(d.id)}">보기</button><button type="button" class="admin-btn" data-record-action="visibility" data-case-id="\${escapeAttr(d.id)}" data-next-public="\${!isPublic ? 'true' : 'false'}">\${isPublic ? '비공개' : '공개'}</button><button type="button" class="admin-btn red" data-record-action="delete" data-case-id="\${escapeAttr(d.id)}">삭제</button></div></td>`
  ],
  [
    `  window._delRecord = async id => {\n    if (!confirm('사건과 판결기록을 함께 삭제할까요?')) return;\n    try { await deleteDoc(doc(db, 'results', id)); } catch {}\n    try { await deleteDoc(doc(db, 'cases', id)); } catch {}\n    toast('삭제 완료', 'success');\n    loadTab('records');\n  };\n}`,
    `  window._delRecord = async id => {\n    if (!confirm('사건과 판결기록을 함께 삭제할까요?')) return;\n    try { await deleteDoc(doc(db, 'results', id)); } catch {}\n    try { await deleteDoc(doc(db, 'cases', id)); } catch {}\n    toast('삭제 완료', 'success');\n    loadTab('records');\n  };\n  el.querySelectorAll('[data-record-action]').forEach(button => {\n    button.addEventListener('click', () => {\n      const id = button.dataset.caseId || '';\n      if (button.dataset.recordAction === 'view') location.href = \`/#/result/\${encodeURIComponent(id)}\`;\n      else if (button.dataset.recordAction === 'visibility') window._recordPublic(id, button.dataset.nextPublic === 'true');\n      else if (button.dataset.recordAction === 'delete') window._delRecord(id);\n    });\n  });\n}`
  ],
  [
    `return \`<tr><td><b>\${escapeHtml(u.nickname || '-')}</b><div style="font-size:10px;color:var(--cream-dim);">\${escapeHtml(d.id)}</div></td><td>\${escapeHtml(u.email || '-')}</td><td>\${escapeHtml(u.provider || '-')}</td><td><button class="admin-btn red" onclick="window._delUserProfile('\${escapeAttr(d.id)}')">프로필 삭제</button></td></tr>\`;`,
    `return \`<tr><td><b>\${escapeHtml(u.nickname || '-')}</b><div style="font-size:10px;color:var(--cream-dim);">\${escapeHtml(d.id)}</div></td><td>\${escapeHtml(u.email || '-')}</td><td>\${escapeHtml(u.provider || '-')}</td><td><button type="button" class="admin-btn red" data-delete-user="\${escapeAttr(d.id)}">프로필 삭제</button></td></tr>\`;`
  ],
  [
    `  window._delUserProfile = async id => { if (!confirm('Auth 계정은 삭제되지 않고 프로필 문서만 삭제됩니다. 계속할까요?')) return; await deleteDoc(doc(db, 'users', id)); toast('프로필 삭제 완료', 'success'); loadTab('users'); };\n}`,
    `  window._delUserProfile = async id => { if (!confirm('Auth 계정은 삭제되지 않고 프로필 문서만 삭제됩니다. 계속할까요?')) return; await deleteDoc(doc(db, 'users', id)); toast('프로필 삭제 완료', 'success'); loadTab('users'); };\n  el.querySelectorAll('[data-delete-user]').forEach(button => {\n    button.addEventListener('click', () => window._delUserProfile(button.dataset.deleteUser || ''));\n  });\n}`
  ],
  [
    `\${types.map(([t,l]) => \`<button class="admin-tab\${active === t ? ' active' : ''}" onclick="window._pt('\${t}')">\${l}</button>\`).join('')}`,
    `\${types.map(([t,l]) => \`<button type="button" class="admin-tab\${active === t ? ' active' : ''}" data-policy-type="\${escapeAttr(t)}">\${escapeHtml(l)}</button>\`).join('')}`
  ],
  [
    `    window._pt = t => { active = t; render(); };`,
    `    window._pt = t => { active = t; render(); };\n    el.querySelectorAll('[data-policy-type]').forEach(button => {\n      button.addEventListener('click', () => window._pt(button.dataset.policyType));\n    });`
  ]
]);
