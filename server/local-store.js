import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function localDb(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  if (!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rooms'").get()) {
    sqlite.exec(readFileSync(new URL('../drizzle/0000_tide_rooms.sql',import.meta.url),'utf8'));
  }
  return {prepare(sql) { return {bind(...args) {
    const stmt = sqlite.prepare(sql);
    return {first:async () => stmt.get(...args) || null, run:async () => ({meta:{changes:stmt.run(...args).changes}})};
  }};}, close:() => sqlite.close()};
}
