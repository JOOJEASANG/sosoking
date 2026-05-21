import { auth, db } from '../firebase.js';
import { doc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { sendGameSystemMessage } from './chat.js';

const GAME_LABELS = {
  liar: '라이어게임',
  mafia: '마피아게임',
  wordtrap: '금칙어 채팅게임',
};

export async function endGameRoom(room) {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다.');
  if (!room?.id) throw new Error('방 정보를 찾지 못했어요.');
  if (room.hostId !== auth.currentUser.uid) throw new Error('방장만 게임을 종료할 수 있습니다.');
  if (room.status === 'ended') throw new Error('이미 종료된 게임입니다.');

  const label = GAME_LABELS[room.game] || '게임';
  const log = `${label}이 방장에 의해 종료되었습니다.`;

  await updateDoc(doc(db, 'game_rooms', room.id), {
    status: 'ended',
    phase: 'ended',
    log,
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await sendGameSystemMessage(room.id, `${label}이 종료되었습니다. 방장이 새 게임을 준비하거나 새 방을 만들 수 있습니다.`, '🎙️ 사회자');
}
