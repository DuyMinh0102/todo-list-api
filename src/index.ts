import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
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

const db = new Database(dbPath, { verbose: console.log });
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )  
`);

const insertData = db.prepare(`INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)`);

const getUserHash = db.prepare(`SELECT password_hash, salt FROM users WHERE username = ?`);

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

function returnNeededFile(res: http.ServerResponse<http.IncomingMessage>, filename: string, filetype: string): void {
  const filePath = path.join(process.cwd(), "public", filetype, filename);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error: Unable to load page");
      return;
    }

    if (filetype === "js") filetype = "javascript";
    res.writeHead(200, { "Content-Type": `text/${filetype}; charset=utf-8` });
    res.end(content);
  });
}

async function handleRegistrationQuery(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage>) {
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

      const checkUserExist = getUserHash.get(username);

      if (checkUserExist) {
        res.writeHead(409, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Username already existed");
        return;
      }

      if (pwd.trim() !== confirmPwd.trim()) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Confirm password does not match");
        return;
      }

      const insertPwd = await hashPassword(pwd);
      const currentTime = new Date().toLocaleDateString();

      insertData.run(username, insertPwd.password_hash, insertPwd.salt, currentTime);

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Registration completed, redirecting to login page in 3 seconds...");
    });
}

async function handleLoginQuery(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage>) {
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

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Login successfully, redirecting to homepage in 3 seconds...");
    });
}

const server = http.createServer((req, res) => {
  const { headers, method, url } = req;

  switch (`${method} ${url}`) {
    case "GET /css/login.css":
      returnNeededFile(res, "login.css", "css");
      break;

    case "GET /js/login_check.js":
      returnNeededFile(res, "login_check.js", "js");
      break;

    case "GET /js/register_check.js":
      returnNeededFile(res, "register_check.js", "js");
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

    case "POST /login":
      handleLoginQuery(req, res);
      break;

    case "POST /register":
      handleRegistrationQuery(req, res);
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
