import * as fs from "node:fs";
import * as path from "node:path";
import { ServerResponse, IncomingMessage, createServer } from "node:http";
import * as crypto from "node:crypto";
import Database from "better-sqlite3";

const dbDir = path.join(process.cwd(), "data");
const dbPath = path.join(dbDir, "app.db");
const PORT = Number(process.env.PORT) || 3000;
const HOST = "localhost";
const MAX_BODY_SIZE = 1e6;

if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

interface hashedPwd {
  password_hash: string;
  salt: string;
}

interface User {
  id: number;
  username: string;
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

const insertUserData = db.prepare(`INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)`);
const insertTaskData = db.prepare(`INSERT INTO tasks (title, description, userid) VALUES (?, ?, ?)`);
const insertSession = db.prepare(`INSERT INTO sessions (id, userid, expire) VALUES (?, ?, ?)`);

const getUserHash = db.prepare(`SELECT password_hash, salt FROM users WHERE username = ?`);
const getUserInfo = db.prepare(`SELECT id, username FROM users WHERE username = ?`);

async function hashPassword(
  pwd: string,
  _salt: string = crypto.randomBytes(128).toString("base64"),
  _iterations: number = 10000,
): Promise<hashedPwd> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(pwd, _salt, _iterations, 64, "sha512", (err, derivedKey) => {
      if (err) return reject(err);

      resolve({
        password_hash: derivedKey.toString("hex"),
        salt: _salt,
      });
    });
  });
}

function parseCookie(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.split("=");
    if (name) cookies[name.trim()] = rest.join("=").trim();
  });

  return cookies;
}

function returnNeededFile(res: ServerResponse<IncomingMessage>, filename: string, filetype: string): void {
  const filePath = path.join(process.cwd(), "public", filetype, filename);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Internal Server Error: Unable to load page");
      return;
    }

    if (filetype === "js") filetype = "javascript";
    res.writeHead(200, { "Content-Type": `text/${filetype}; charset=utf-8` });
    res.end(content);
  });
}

async function handleRegistrationQuery(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  let body: Buffer[] = [];
  let bodySize = 0;

  req
    .on("error", (err) => {
      console.error(err);

      if (!res.headersSent) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad request");
      }
    })
    .on("data", (chunk) => {
      bodySize += chunk.length;

      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { "Content-Type": "text/plain" });
        res.end("Payload too large");
        req.destroy();
      }

      body.push(chunk);
    })
    .on("end", async () => {
      if (res.writableEnded) return;
      const parsedBody = new URLSearchParams(Buffer.concat(body).toString());
      const username = parsedBody.get("username"),
        email = parsedBody.get("email"),
        pwd = parsedBody.get("pwd"),
        confirmPwd = parsedBody.get("confirm_pwd");

      if (!username || !email || !pwd || !confirmPwd) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("All fields must be filled.");
        return;
      }

      try {
        const checkUserExist = getUserHash.get(username);
        if (checkUserExist) {
          res.writeHead(409, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Username already exists.");
          return;
        }

        if (pwd.trim() !== confirmPwd.trim()) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Confirm password does not match");
          return;
        }

        const insertPwd = await hashPassword(pwd);
        insertUserData.run(username, insertPwd.password_hash, insertPwd.salt);

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Registration completed, redirecting to login page in 3 seconds...");
      } catch (err) {
        console.error("Registration error:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });
}

async function handleLoginQuery(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  let body: Buffer[] = [];
  let bodySize = 0;

  req
    .on("error", (err) => {
      console.error(err);

      if (!res.headersSent) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad request");
      }
    })
    .on("data", (chunk) => {
      bodySize += chunk.length;

      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { "Content-Type": "text/plain" });
        res.end("Payload too large");
        req.destroy();
      }

      body.push(chunk);
    })
    .on("end", async () => {
      if (res.writableEnded) return;
      const parsedBody = new URLSearchParams(Buffer.concat(body).toString());
      const username = parsedBody.get("username"),
        pwd = parsedBody.get("pwd");

      if (!username || !pwd) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Username and Password are required.");
        return;
      }

      try {
        const queryUser = getUserHash.get(username) as hashedPwd | undefined;
        if (!queryUser) {
          res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Username does not exist");
          return;
        }

        const currentPwdHash = await hashPassword(pwd, queryUser.salt);

        if (currentPwdHash.password_hash !== queryUser.password_hash) {
          res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Wrong password");
          return;
        }

        const sessionID = crypto.randomBytes(32).toString("hex");
        const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const currentUser = getUserInfo.get(username) as User;

        insertSession.run(sessionID, currentUser.id, expireAt);

        res.writeHead(200, {
          "Set-Cookie": `session_id=${sessionID}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
          "Content-Type": "text/plain",
        });
        res.end("Login successfully, redirecting to homepage in 3 seconds...");
      } catch (err) {
        console.error("Login error:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });
}

async function handleAddTaskQuery(req: IncomingMessage, res: ServerResponse<IncomingMessage>): Promise<void> {
  let body: Buffer[] = [];
  let bodySize = 0;

  req
    .on("error", (err) => {
      console.error(err);

      if (!res.headersSent) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad request");
      }
    })
    .on("data", (chunk) => {
      bodySize += chunk.length;

      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { "Content-Type": "text/plain" });
        res.end("Payload too large");
        req.destroy();
      }

      body.push(chunk);
    })
    .on("end", async () => {
      if (res.writableEnded) return;
      const parsedBody = new URLSearchParams(Buffer.concat(body).toString());

      const taskTitle = parsedBody.get("title");
      const taskDesc = parsedBody.get("description");

      if (!taskTitle) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Title is required.");
        return;
      }

      const cookies = parseCookie(req.headers.cookie);
      const sessionID = cookies["session_id"];

      if (!sessionID) {
        res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Unauthorized: Missing session cookie");
        return;
      }

      try {
        const stmt = db.prepare(
          `SELECT users.id, users.username FROM sessions JOIN users ON sessions.userid = users.id WHERE sessions.id = ? AND datetime(sessions.expire) > datetime('now')`,
        );
        const currentUser = stmt.get(sessionID) as User | undefined;

        if (!currentUser) {
          res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Unauthorized: Invalid or expired session");
          return;
        }

        insertTaskData.run(taskTitle, taskDesc, currentUser.id);

        res.writeHead(201, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Task added successfully");
      } catch (err) {
        console.error("Task creation error:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });
}

function handleGetTasksQuery(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  const cookies = parseCookie(req.headers.cookie);
  const sessionID = cookies["session_id"];

  if (!sessionID) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  try {
    const stmt = db.prepare(`
      SELECT tasks.id, tasks.title, tasks.description, tasks.created_at 
      FROM tasks 
      JOIN sessions ON tasks.userid = sessions.userid 
      WHERE sessions.id = ? AND datetime(sessions.expire) > datetime('now')
    `);
    const tasks = stmt.all(sessionID);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(tasks));
  } catch (err) {
    console.error("Fetch tasks error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
}

const server = createServer((req, res) => {
  const { headers, method, url } = req;

  switch (`${method} ${url}`) {
    case "GET /css/login.css":
      returnNeededFile(res, "login.css", "css");
      break;

    case "GET /css/style.css":
      returnNeededFile(res, "style.css", "css");
      break;

    case "GET /js/login_check.js":
      returnNeededFile(res, "login_check.js", "js");
      break;

    case "GET /js/register_check.js":
      returnNeededFile(res, "register_check.js", "js");
      break;

    case "GET /js/index.js":
      returnNeededFile(res, "index.js", "js");
      break;

    case "GET /":
    case "GET /login":
      returnNeededFile(res, "login.html", "html");
      break;

    case "GET /register":
      returnNeededFile(res, "register.html", "html");
      break;

    case "GET /home":
      returnNeededFile(res, "index.html", "html");
      break;

    case "GET /tasks":
      handleGetTasksQuery(req, res);
      break;

    case "POST /login":
      handleLoginQuery(req, res);

      break;

    case "POST /register":
      handleRegistrationQuery(req, res);
      break;

    case "POST /add-task":
      handleAddTaskQuery(req, res);
      break;

    default:
      res.statusCode = 404;
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      break;
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
