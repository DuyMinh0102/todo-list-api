import { existsSync, mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { join } from "node:path";

export const dbDir = join(process.cwd(), "data");
export const dbPath = join(dbDir, "app.db");

if (!existsSync(dbPath)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: console.log });
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    userid INTEGER NOT NULL,
    status STRING NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userid INTEGER NOT NULL,
    expire DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userid) REFERENCES users(id) ON DELETE CASCADE
  );
`);

export const insertUserData = db.prepare(`INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)`);
export const insertTaskData = db.prepare(`INSERT INTO tasks (title, description, userid, status) VALUES (?, ?, ?, ?)`);
export const insertSession = db.prepare(`INSERT INTO sessions (id, userid, expire) VALUES (?, ?, ?)`);

export const getUserHash = db.prepare(`SELECT password_hash, salt FROM users WHERE username = ?`);
export const getUserInfo = db.prepare(`SELECT id, username FROM users WHERE username = ?`);
export const getSessionInfo = db.prepare(
  `SELECT users.id, users.username FROM sessions JOIN users ON sessions.userid = users.id WHERE sessions.id = ? AND datetime(sessions.expire) > datetime('now')`,
);
export const getTasks = db.prepare(`
  SELECT tasks.id, tasks.title, tasks.description, tasks.created_at, tasks.status 
  FROM tasks 
  JOIN sessions ON tasks.userid = sessions.userid 
  WHERE sessions.id = ? AND datetime(sessions.expire) > datetime('now')
`);
export const markAsComplete = db.prepare(`UPDATE tasks SET status = 'Completed' WHERE id = ? AND userid = ?`);

export const deleteTask = db.prepare(`DELETE FROM tasks where ID = ? AND userid = ?`);
export const deleteSession = db.prepare(`DELETE FROM sessions where id = ?`);
