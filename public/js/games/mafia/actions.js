import { auth, db, functions } from '../../firebase.js';
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { makeRoomCode, gamePlayerName } from '../common.js';
import { sendGameSystemMessages } from '../chat.js';
import { assignRoles, judgeAfterElimination, roleLabel, topVoteTarget } from './rules.js';

function moderatorRoleSummary(roles = []) {
  const counts = roles.reduce((acc, role) => {
    const label = roleLabel(role);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([label, count]) => `${label} ${count}명`).join(' · ');
}

export async function createMafiaRoom({ title, maxPlayers, mafiaCount, withAI, difficulty }) {
  if (!auth.currentUser) throw new Error('로그인이 필요합니다.');
  const room = {
    game: 'mafia',
    status: 'waiting',
    phase: 'waiting',
    title: title || '마피아게임',
    maxPlayers: Number(maxPlayers || 6),
    mafiaCount: Number(mafiaCount || 1),
    code: makeRoomCode(),
    hostId: auth.currentUser.uid,
    hostName: gamePlayerName('방장'),
    day: 0,
    withAI: !!withAI,
    aiDifficulty: difficulty || 'normal',
    log: '참가자를 모은 뒤 게임을 시작하세요.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'game_rooms'), room);
  await setDoc(doc(db, 'game_rooms', ref.id, 'players', auth.currentUser.uid), makeMafiaPlayer('host'));
  return ref.id;
}

export function makeMafiaPlayer(role = 'player') {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');
  return {
    uid: auth.currentUser.uid,
    name: gamePlayerName(),
    role,
    assignedRole: '',
    alive: true,
    votedFor: '',
    joinedAt: serverTimestamp(),
  };
}

export async function joinMafiaRoom(room, currentCount) {
  if (!auth.currentUser) throw new Error('게임 접속 정보를 확인하지 못했어요. 다시 시도해주세요.');
  if (currentCount >= Number(room.maxPlayers || 0)) throw new Error('방이 가득 찼어요');
  const playerRole = auth.currentUser.uid === room.hostId ? 'host' : 'player';
  await setDoc(doc(db, 'game_rooms', room.id, 'players', auth.currentUser.uid), makeMafiaPlayer(playerRole), { merge: true });
}

export async function startMafiaGame(room) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  if (room.hostId !== uid) throw new Error('호스트만 이 작업을 수행할 수 있습니다.');
  const playersSnap = await getDocs(query(collection(db, 'game_rooms', room.id, 'players'), orderBy('joinedAt', 'asc')));
  let players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (players.length < 3) throw new Error('마피아게임은 3명 이상부터 추천해요');

  // AI 플레이어 추가
  if (room.withAI && !room.aiPlayerUid) {
    try {
      const addAi = httpsCallable(functions, 'addAiGamePlayer');
      const result = await addAi({ roomId: room.id, difficulty: room.aiDifficulty || 'normal' });
      if (result.data?.ok) {
        players = [...players, {
          id: result.data.aiUid,
          uid: result.data.aiUid,
          name: result.data.aiName,
          role: 'player',
          assignedRole: '',
          alive: true,
          votedFor: '',
          isAI: true,
        }];
      }
    } catch (e) {
      console.warn('[mafia] AI add failed', e.message);
    }
  }

  const roles = assignRoles(players, room.mafiaCount);

  // AI가 있으면 항상 AI를 마피아로 지정
  const aiIdx = players.findIndex(p => p.isAI || (room.aiPlayerUid && p.uid === room.aiPlayerUid));
  if (aiIdx >= 0) {
    // 마피아 역할을 AI에게 배정하고 다른 마피아 자리는 citizen으로 조정
    const currentMafiaIdx = roles.findIndex(r => r === 'mafia');
    if (currentMafiaIdx >= 0 && currentMafiaIdx !== aiIdx) {
      const temp = roles[aiIdx];
      roles[aiIdx] = roles[currentMafiaIdx];
      roles[currentMafiaIdx] = temp;
    }
    if (roles[aiIdx] !== 'mafia') roles[aiIdx] = 'mafia';
  }

  await Promise.all(players.map((p, i) => setDoc(doc(db, 'game_rooms', room.id, 'players', p.uid || p.id), {
    assignedRole: roles[i],
    alive: true,
    votedFor: '',
  }, { merge: true })));

  await updateDoc(doc(db, 'game_rooms', room.id), {
    status: 'playing',
    phase: 'day',
    day: 1,
    log: '역할을 확인하세요. 마피아(AI 포함)를 찾아 투표하세요!',
    updatedAt: serverTimestamp(),
  });

  const aiInfo = (room.withAI || room.aiPlayerUid) ? '🤖 AI가 마피아로 잠입해 있습니다. ' : '';
  await sendGameSystemMessages(room.id, [
    '마피아게임을 시작합니다.',
    `총 ${players.length}명이 참가했습니다. 역할 구성은 ${moderatorRoleSummary(roles)}입니다.`,
    `${aiInfo}각자 역할 카드를 확인하세요. 마피아는 시민처럼 행동해야 합니다.`,
    '1라운드 낮 토론을 시작합니다. 의심되는 사람에게 질문하고 투표하세요.',
  ]);
}

export async function voteMafia(roomId, targetUid) {
  await setDoc(doc(db, 'game_rooms', roomId, 'players', auth.currentUser.uid), { votedFor: targetUid }, { merge: true });
}

export async function countMafiaVote(room, players) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  if (room.hostId !== uid) throw new Error('호스트만 이 작업을 수행할 수 있습니다.');
  const voteResult = topVoteTarget(players);
  if (voteResult.status === 'empty') throw new Error('아직 투표가 없습니다');

  const roomRef = doc(db, 'game_rooms', room.id);

  if (voteResult.status === 'tie') {
    const nextDay = Number(room.day || 1) + 1;
    const log = `동표입니다. 탈락자 없이 ${nextDay}라운드로 넘어갑니다.`;
    await clearMafiaVotes(room, players, log);
    await sendGameSystemMessages(room.id, [
      '투표 결과 동표입니다.',
      '이번 라운드는 탈락자 없이 넘어갑니다.',
      `${nextDay}라운드 낮 토론을 시작합니다. 다시 의심 대상을 좁혀보세요.`,
    ]);
    return;
  }

  const target = players.find(p => p.uid === voteResult.targetUid);
  if (!target) return;

  const judged = judgeAfterElimination(players, target.uid);
  await setDoc(doc(db, 'game_rooms', room.id, 'players', target.uid), { alive: false, votedFor: '' }, { merge: true });
  await Promise.all(judged.nextPlayers.map(p => setDoc(doc(db, 'game_rooms', room.id, 'players', p.uid), { votedFor: '' }, { merge: true })));

  const wasAI = target.uid === room.aiPlayerUid;
  let log = `${target.name}님이 투표로 탈락했습니다.${wasAI ? ' 🤖 AI였습니다!' : ''}`;
  const messages = [
    `투표 결과 ${target.name}님이 ${voteResult.count}표로 지목됐습니다.`,
    `${target.name}님은 ${roleLabel(target.assignedRole)}${wasAI ? '(🤖 AI)' : ''}였습니다.`,
  ];

  if (judged.winner === 'citizen') {
    log = `시민 승리! ${wasAI ? 'AI 마피아를 찾아냈습니다!' : '마피아가 모두 사라졌습니다.'}`;
    messages.push(wasAI ? '🎉 AI 마피아를 찾아냈습니다! 시민팀 완벽 승리!' : '마피아가 모두 사라졌습니다. 시민팀 승리입니다!');
  } else if (judged.winner === 'mafia') {
    log = '마피아 승리! 마피아 수가 시민 수 이상이 되었습니다.';
    messages.push('마피아 수가 시민팀 수 이상이 되었습니다. 마피아 승리입니다!');
  } else {
    messages.push(`${Number(room.day || 1) + 1}라운드 낮 토론을 시작합니다. 남은 참가자들은 다시 대화하고 투표하세요.`);
  }

  await updateDoc(roomRef, {
    status: judged.status,
    phase: judged.status === 'ended' ? 'ended' : 'day',
    day: Number(room.day || 1) + 1,
    log,
    updatedAt: serverTimestamp(),
  });

  await sendGameSystemMessages(room.id, messages);
}

export async function clearMafiaVotes(room, players, log) {
  await Promise.all(players.map(p => setDoc(doc(db, 'game_rooms', room.id, 'players', p.uid), { votedFor: '' }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', room.id), {
    phase: 'day',
    day: Number(room.day || 1) + 1,
    log,
    updatedAt: serverTimestamp(),
  });
}

export async function resetMafiaGame(room, players) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  if (room.hostId !== uid) throw new Error('호스트만 이 작업을 수행할 수 있습니다.');
  await Promise.all(players.map(p => setDoc(doc(db, 'game_rooms', room.id, 'players', p.uid), {
    assignedRole: '',
    alive: true,
    votedFor: '',
  }, { merge: true })));
  await updateDoc(doc(db, 'game_rooms', room.id), {
    status: 'waiting',
    phase: 'waiting',
    day: 0,
    log: '새 게임을 준비합니다. 방장이 다시 시작할 수 있어요.',
    updatedAt: serverTimestamp(),
  });
  await sendGameSystemMessages(room.id, [
    '새 게임 준비 상태로 돌아갑니다.',
    '방장이 다시 게임을 시작하면 역할이 새로 배정됩니다.',
  ]);
}
