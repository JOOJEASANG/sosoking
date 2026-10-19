import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  profilePhotoUrl,
  generatedAvatarUrl,
  avatarSourceLabel,
  avatarImg
} from '../../public/js/utils/avatar.js';

test('profilePhotoUrl prefers a user-uploaded data image', () => {
  const data = 'data:image/png;base64,AAAA';
  assert.equal(profilePhotoUrl(null, { photoData: data }), data);
  // A non-image photoData string is ignored in favor of the next source.
  assert.equal(
    profilePhotoUrl(null, { photoData: 'javascript:evil', photoURL: 'https://example.com/p.jpg' }),
    'https://example.com/p.jpg'
  );
});

test('profilePhotoUrl upsizes Google-hosted photos only', () => {
  assert.equal(
    profilePhotoUrl(null, { photoURL: 'https://lh3.googleusercontent.com/a/abc=s96-c' }, 200),
    'https://lh3.googleusercontent.com/a/abc=s400-c'
  );
  assert.equal(
    profilePhotoUrl(null, { photoURL: 'https://lh3.googleusercontent.com/a/abc' }, 200),
    'https://lh3.googleusercontent.com/a/abc=s400-c'
  );
  // A non-Google https URL passes through untouched.
  assert.equal(
    profilePhotoUrl(null, { photoURL: 'https://example.com/p.jpg' }),
    'https://example.com/p.jpg'
  );
});

test('profilePhotoUrl never trusts a non-https photo URL', () => {
  for (const bad of ['javascript:alert(1)', 'http://evil.example/x.jpg', 'data:text/html,<script>']) {
    const result = profilePhotoUrl(null, { photoURL: bad });
    assert.ok(result.startsWith('data:image/svg+xml'), `unsafe url leaked: ${bad} -> ${result}`);
  }
});

test('generatedAvatarUrl is deterministic and embeds the initial', () => {
  const a = generatedAvatarUrl('철수', 'a@b.com', 'seed');
  const b = generatedAvatarUrl('철수', 'a@b.com', 'seed');
  assert.equal(a, b);
  assert.ok(a.startsWith('data:image/svg+xml;charset=UTF-8,'));

  const svg = decodeURIComponent(generatedAvatarUrl('bob').split(',')[1]);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('>B<'));
  // Empty input falls back to the default mark.
  const fallbackSvg = decodeURIComponent(generatedAvatarUrl('', '', '').split(',')[1]);
  assert.ok(fallbackSvg.includes('소'));
});

test('avatarImg escapes attacker-controlled attributes', () => {
  const html = avatarImg(null, { nickname: '<script>"x"' });
  assert.ok(html.includes('alt="&lt;script&gt;&quot;x&quot;"'));
  assert.ok(!html.includes('<script>'));
});

test('avatarSourceLabel reflects the active photo source', () => {
  assert.equal(avatarSourceLabel(null, { photoData: 'data:image/png;base64,AA' }), '직접 올린 사진 사용 중');
  assert.equal(avatarSourceLabel(null, { photoURL: 'https://x/y.jpg' }), '구글 프로필 사진 사용 중');
  assert.equal(avatarSourceLabel(null, {}), '닉네임 기반 자동 생성 아이콘');
});
