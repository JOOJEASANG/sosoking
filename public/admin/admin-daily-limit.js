import { getApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const db = getFirestore(getApp());
const DEFAULT_DAILY_LIMIT = 3;
let settingsPromise = null;

function clampLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DAILY_LIMIT;
  return Math.max(1, Math.min(1000, parsed));
}

function loadSettings(force = false) {
  if (force || !settingsPromise) {
    settingsPromise = getDoc(doc(db, 'site_settings', 'config'))
      .then(snapshot => snapshot.exists() ? snapshot.data() : {})
      .catch(error => {
        settingsPromise = null;
        throw error;
      });
  }
  return settingsPromise;
}

function syncLimitInput(form, enabled) {
  const input = form.querySelector('#dl');
  if (!(input instanceof HTMLInputElement)) return;
  input.disabled = !enabled;
  input.setAttribute('min', '1');
  input.setAttribute('max', '1000');
  input.setAttribute('aria-disabled', String(!enabled));
}

async function enhanceSiteSettings(root) {
  const form = root.querySelector('#site-form');
  const limitInput = form?.querySelector('#dl');
  if (!(form instanceof HTMLFormElement) || !(limitInput instanceof HTMLInputElement)) return;
  if (form.dataset.dailyLimitEnhanced === 'true') return;
  form.dataset.dailyLimitEnhanced = 'true';

  const settings = await loadSettings();
  if (!form.isConnected) return;

  const enabled = settings.dailyLimitEnabled === true;
  limitInput.value = String(clampLimit(settings.dailyLimit ?? DEFAULT_DAILY_LIMIT));

  const group = limitInput.closest('.form-group');
  if (group && !group.querySelector('#daily-limit-enabled')) {
    group.insertAdjacentHTML('beforebegin', `
      <div class="card" style="padding:15px 16px;margin-bottom:14px;background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.32);">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:13px;line-height:1.65;">
          <input type="checkbox" id="daily-limit-enabled" ${enabled ? 'checked' : ''} style="margin-top:3px;min-width:18px;min-height:18px;">
          <span><strong style="color:var(--gold);">회원별 일일 사건 접수 제한 사용</strong><br><span style="color:var(--cream-dim);">끄면 제한 없이 계속 테스트할 수 있습니다. 켜면 아래 입력한 건수까지만 접수됩니다.</span></span>
        </label>
      </div>`);
  }

  const toggle = form.querySelector('#daily-limit-enabled');
  if (toggle instanceof HTMLInputElement) {
    toggle.checked = enabled;
    syncLimitInput(form, toggle.checked);
    toggle.addEventListener('change', () => syncLimitInput(form, toggle.checked));
  }

  const cooldown = form.querySelector('#cd');
  if (cooldown?.closest('.form-group') && !form.querySelector('[data-limit-test-note]')) {
    cooldown.closest('.form-group').insertAdjacentHTML('afterend', `
      <div data-limit-test-note style="margin:-4px 0 18px;font-size:11px;line-height:1.65;color:var(--cream-dim);">
        연속 테스트가 필요하면 재접수 대기시간도 0초로 저장하세요. Gemini 요청 한도는 아래 별도 설정을 따릅니다.
      </div>`);
  }

  form.addEventListener('submit', async () => {
    const dailyLimitEnabled = toggle instanceof HTMLInputElement && toggle.checked;
    const dailyLimit = clampLimit(limitInput.value);
    limitInput.value = String(dailyLimit);
    try {
      await Promise.all([
        setDoc(doc(db, 'site_settings', 'config'), {
          dailyLimitEnabled,
          dailyLimit,
          updatedAt: serverTimestamp()
        }, { merge: true }),
        setDoc(doc(db, 'site_public', 'config'), {
          dailyLimitEnabled,
          dailyLimit,
          updatedAt: serverTimestamp()
        }, { merge: true })
      ]);
      settingsPromise = Promise.resolve({ ...settings, dailyLimitEnabled, dailyLimit });
    } catch (error) {
      console.error('administrator daily limit save failed:', error);
    }
  });
}

async function updateOverview(root) {
  const heading = Array.from(root.querySelectorAll('strong'))
    .find(element => element.textContent?.trim() === '접수 제한');
  if (!heading || heading.dataset.dailyLimitStatus === 'true') return;

  const settings = await loadSettings();
  if (!heading.isConnected) return;
  const textNode = heading.nextSibling;
  if (!textNode) return;

  const enabled = settings.dailyLimitEnabled === true;
  const limit = clampLimit(settings.dailyLimit ?? DEFAULT_DAILY_LIMIT);
  const cooldown = Math.max(0, Math.min(300, Number(settings.cooldownSec ?? 45) || 0));
  textNode.textContent = enabled
    ? `: 일 ${limit}건 · 쿨다운 ${cooldown}초`
    : `: 제한 없음 · 쿨다운 ${cooldown}초`;
  heading.dataset.dailyLimitStatus = 'true';
}

function inspect() {
  const root = document.getElementById('admin-content');
  if (!root) return;
  void enhanceSiteSettings(root).catch(error => console.warn('daily limit form enhancement failed:', error));
  void updateOverview(root).catch(error => console.warn('daily limit overview update failed:', error));
}

const observer = new MutationObserver(inspect);
const start = () => {
  const root = document.getElementById('admin-content');
  if (!root) return;
  observer.observe(root, { childList: true, subtree: true });
  inspect();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();