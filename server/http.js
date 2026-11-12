import { roomRequest, RoomError } from './rooms.js';
import { RoomsStore } from './store.js';

const GAME_ORIGIN = 'https://sosoking-481e6.web.app';
const GAME_ORIGINS = new Set([GAME_ORIGIN, 'https://sosoking-481e6.firebaseapp.com']);
export async function api(request, db, context) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return Response.redirect(GAME_ORIGIN+'/',302);
  const origin = request.headers.get('origin');
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const send = (body, status=200) => new Response(JSON.stringify(body),{status,headers});
  if (origin) {
    if (origin !== url.origin && !GAME_ORIGINS.has(origin)) return send({error:'이 주소에서는 게임방에 접근할 수 없어요.'},403);
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (url.pathname === '/api/status' && request.method === 'GET') return send({game:'tidepost',protocol:1});
  if (url.pathname !== '/api/room' || request.method !== 'POST') return send({error:'요청 경로를 확인해 주세요.'},404);
  try {
    if (Number(request.headers.get('content-length')) > 2048) return send({error:'요청이 너무 길어요.'},413);
    const body = await request.text();
    if (body.length > 2048) return send({error:'요청이 너무 길어요.'},413);
    let input;
    try { input = JSON.parse(body); } catch { return send({error:'요청 형식이 올바르지 않아요.'},400); }
    const rooms = new RoomsStore(db);
    const result = await roomRequest(rooms,input);
    if (input.op === 'create') {
      const clean = rooms.clean(Date.now()).catch(() => {});
      if (context?.waitUntil) context.waitUntil(clean); else await clean;
    }
    return send(result);
  } catch (error) {
    if (error instanceof RoomError) return send({error:error.message},error.status);
    console.error('Tidepost room storage unavailable', error?.name);
    return send({error:'항구 연결이 잠시 끊겼어요. 다시 시도해 주세요.'},503);
  }
}
export default {fetch(request,env,ctx) { return api(request,env.DB,ctx); }};
