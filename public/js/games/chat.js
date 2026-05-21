import { auth, db } from '../firebase.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { gamePlayerName, esc } from './common.js';

export async function sendGameChat(roomId, text) {
  const message = String(text || '').trim();
  if (!roomId) throw new Error('방 정보를 찾지 못했어요.');
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요.');
  if (!message) throw new Error('메시지를 입력해주세요.');
  if (message.length > 240) throw new Error('메시지는 240자 이하로 입력해주세요.');

  await addDoc(collection(db, 'game_rooms', roomId, 'chats'), {
    uid: auth.currentUser.uid,
    name: gamePlayerName('참가자'),
    text: message,
    type: 'chat',
    createdAt: serverTimestamp(),
  });
}

export async function sendGameSystemMessage(roomId, text, name = '🎙️ 사회자') {
  const message = String(text || '').trim();
  if (!roomId || !message) return;
  await addDoc(collection(db, 'game_rooms', roomId, 'chats'), {
    uid: 'system',
    name,
    text: message.slice(0, 500),
    type: 'system',
    createdAt: serverTimestamp(),
  });
}

export async function sendGameSystemMessages(roomId, messages = [], name = '🎙️ 사회자') {
  for (const message of messages) {
    await sendGameSystemMessage(roomId, message, name);
  }
}

export function renderGameChatHTML({ room, chats = [], joined = false, inputId = 'game-chat-input', sendId = 'game-chat-send', title = '토론 채팅', hint = '차례를 정해 한 명씩 설명하고, 의심되는 부분은 질문해보세요.' }) {
  const list = chats.slice(-80);
  return `
    <section class="game-chat-card">
      <div class="game-chat-card__head">
        <div>
          <b>💬 ${esc(title)}</b>
          <span>${esc(hint)}</span>
        </div>
        <small>${list.length}개</small>
      </div>
      <div class="game-chat-list" id="game-chat-list" aria-live="polite">
        ${list.length ? list.map(chat => renderChatItem(chat)).join('') : '<div class="game-chat-empty">아직 대화가 없습니다. 첫 설명을 남겨보세요.</div>'}
      </div>
      ${joined ? `
        <div class="game-chat-input-row">
          <input class="form-input" id="${inputId}" maxlength="240" placeholder="채팅으로 설명하거나 질문하세요">
          <button class="btn btn--primary btn--sm" id="${sendId}" type="button">전송</button>
        </div>` : `
        <div class="game-chat-locked">참가하기를 누르면 채팅에 참여할 수 있어요.</div>`}
    </section>`;
}

function renderChatItem(chat) {
  const isSystem = chat.type === 'system' || chat.uid === 'system';
  const mine = !isSystem && auth.currentUser?.uid && chat.uid === auth.currentUser.uid;
  const initial = isSystem ? '🎙️' : String(chat.name || '?').slice(0, 1);
  return `
    <div class="game-chat-item ${mine ? 'is-mine' : ''} ${isSystem ? 'is-system' : ''}">
      <i>${esc(initial)}</i>
      <div>
        <div class="game-chat-item__meta"><b>${esc(chat.name || (isSystem ? '사회자' : '참가자'))}</b>${mine ? '<span>나</span>' : ''}${isSystem ? '<span>안내</span>' : ''}</div>
        <p>${esc(chat.text || '').replace(/\n/g, '<br>')}</p>
      </div>
    </div>`;
}

export function scrollGameChatToBottom() {
  const list = document.getElementById('game-chat-list');
  if (list) list.scrollTop = list.scrollHeight;
}
