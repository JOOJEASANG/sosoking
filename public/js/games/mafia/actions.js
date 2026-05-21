import { auth, db } from '../../firebase.js';
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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

export async function createMafiaRoom({ title, maxPlayers, mafiaCount }) {
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
    log: '참가자를 모은 뒤 게임을 시작하세요.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'game_rooms'), room);
  await setDoc(doc(db, 'game_rooms', ref.id, 'players', auth.currentUser.uid), makeMafiaPlayer('host'));
  return ref.id;
}

export function makeMafiaPlayer(role = 'player') {
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
  if (currentCount >= Number(room.maxPlayers || 0)) throw new Error('방이 가득 찼어요');
  const playerRole = auth.currentUser.uid === room.hostId ? 'host' : 'player';
  await setDoc(doc(db, 'game_rooms', room.id, 'players', auth.currentUser.uid), makeMafiaPlayer(playerRole), { merge: true });
}

export async function startMafiaGame(room) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  if (room.hostId !== uid) throw new Error('호스트만 이 작업을 수행할 수 있습니다.');
  const playersSnap = await getDocs(query(collection(db, 'game_rooms', room.id, 'players'), orderBy('joinedAt', 'asc')));
  const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (players.length < 3) throw new Error('마피아게임은 3명 이상부터 추천해요');

  const roles = assignRoles(players, room.mafiaCount);
  await Promise.all(players.map((p, i) => setDoc(doc(db, 'game_rooms', room.id, 'players', p.id), {
    assignedRole: roles[i],
    alive: true,
    votedFor: '',
  }, { merge: true })));

  await updateDoc(doc(db, 'game_rooms', room.id), {
    status: 'playing',
    phase: 'day',
    day: 1,
    log: '사회자가 역할을 배정했습니다. 서로 질문하고 마피아를 찾아 투표하세요.',
    updatedAt: serverTimestamp(),
  });

  await sendGameSystemMessages(room.id, [
    '마피아게임을 시작합니다.',
    `총 ${players.length}명이 참가했습니다. 역할 구성은 ${moderatorRoleSummary(roles)}입니다.`,
    '각자 역할 카드를 확인하세요. 마피아는 정체를 숨기고, 시민팀은 말투와 투표 흐름을 보고 마피아를 찾아내세요.',
    '낮 토론을 시작합니다. 충분히 대화한 뒤 의심되는 사람에게 투표하세요.',
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

  let log = `${target.name}님이 투표로 탈락했습니다.`;
  const messages = [
    `투표 결과 ${target.name}님이 ${voteResult.count}표로 지목됐습니다.`,
    `${target.name}님은 ${roleLabel(target.assignedRole)}였습니다.`,
  ];

  if (judged.winner === 'citizen') {
    log = `시민 승리! ${target.name}님이 탈락했고 마피아가 모두 사라졌습니다.`;
    messages.push('마피아가 모두 사라졌습니다. 시민팀 승리입니다!');
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
    '방장이 다시 게임을 시작하면 역할이 새로 랜덤 배정됩니다.',
  ]);
}
