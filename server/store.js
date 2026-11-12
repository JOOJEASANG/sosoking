export class RoomsStore {
  constructor(db) { this.db = db; }
  async get(code) {
    const row = await this.db.prepare('SELECT version, expires, payload FROM rooms WHERE code = ?').bind(code).first();
    return row && {version:row.version, expires:row.expires, room:JSON.parse(row.payload)};
  }
  async insert(room, expires) {
    const result = await this.db.prepare('INSERT INTO rooms(code, version, expires, payload) VALUES(?, 1, ?, ?) ON CONFLICT(code) DO NOTHING')
      .bind(room.code, expires, JSON.stringify(room)).run();
    return result.meta.changes === 1;
  }
  async swap(row, room, expires) {
    const result = await this.db.prepare('UPDATE rooms SET version = version + 1, expires = ?, payload = ? WHERE code = ? AND version = ?')
      .bind(expires, JSON.stringify(room), room.code, row.version).run();
    return result.meta.changes === 1;
  }
  async clean(now) {
    return this.db.prepare('DELETE FROM rooms WHERE code IN (SELECT code FROM rooms WHERE expires < ? LIMIT 40)').bind(now).run();
  }
}
