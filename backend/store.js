import { Database } from 'bun:sqlite';
import { createHash, timingSafeEqual } from 'node:crypto';

export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function authorized(token, hash) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(tokenHash(token), 'hex'), Buffer.from(hash, 'hex'));
}
export function createStore(path) {
  const db = new Database(path, { create: true });
  db.run('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.run(`CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, subject TEXT NOT NULL, day TEXT NOT NULL, created INTEGER NOT NULL, snapshot TEXT NOT NULL, reserved INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS usage (subject TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(subject, day));`);
  const save = db.query('UPDATE jobs SET snapshot=? WHERE id=?');
  const changeUsage = db.query('INSERT INTO usage(subject,day,count) VALUES(?,?,?) ON CONFLICT(subject,day) DO UPDATE SET count=MAX(0,count+excluded.count)');
  const count = (subject, day) => db.query('SELECT count FROM usage WHERE subject=? AND day=?').get(subject, day)?.count || 0;
  const refund = db.transaction(id => {
    const row = db.query('SELECT * FROM jobs WHERE id=?').get(id);
    if (!row?.reserved) return;
    // Refund guest credits, but never the global attempt budget: canceled inference can still be billed.
    changeUsage.run(row.subject, row.day, -1);
    db.query('UPDATE jobs SET reserved=0 WHERE id=?').run(id);
  });
  return {
    get(id) { const row = db.query('SELECT * FROM jobs WHERE id=?').get(id); return row ? { ...JSON.parse(row.snapshot), tokenHash: row.token_hash } : null; },
    save(job) { const { controller, tokenHash: _hash, ...snapshot } = job; save.run(JSON.stringify(snapshot), job.id); },
    reserve: db.transaction((job, subject, day, dailyLimit, globalLimit) => {
      if (count(subject, day) >= dailyLimit || count('*', day) >= globalLimit) return false;
      const { controller, tokenHash: hash, ...snapshot } = job;
      db.query('INSERT INTO jobs(id,token_hash,subject,day,created,snapshot) VALUES(?,?,?,?,?,?)').run(job.id, hash, subject, day, job.createdAt, JSON.stringify(snapshot));
      changeUsage.run(subject, day, 1); changeUsage.run('*', day, 1); return true;
    }),
    refund,
    recover() {
      for (const row of db.query('SELECT id,snapshot FROM jobs WHERE reserved=1').all()) {
        const job = JSON.parse(row.snapshot);
        if (['processing', 'queued'].includes(job.status)) {
          job.status = 'failed'; job.error = 'The server restarted during processing. Please try again.'; save.run(JSON.stringify(job), row.id); refund(row.id);
        }
      }
    },
    expired(before) { return db.query('SELECT id FROM jobs WHERE created<?').all(before).map(row => row.id); },
    delete(id) { db.query('DELETE FROM jobs WHERE id=?').run(id); },
    cleanupUsage(day) { db.query('DELETE FROM usage WHERE day<?').run(day); },
    remaining(subject, day, limit) { return Math.max(0, limit - count(subject, day)); },
    close() { db.close(); },
  };
}
