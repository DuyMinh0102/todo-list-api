import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import Database from "better-sqlite3";

const dbDir = path.join(process.cwd(), "data");
const dbPath = path.join(dbDir, "app.db");

if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: console.log });
db.pragma("journal_mode = WAL");

interface LoginForm {
  userName: string;
  pwd: string;
}

interface RegisterForm {
  userName: string;
  email: string;
  pwd: string;
  confirm_pwd: string;
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = "localhost";

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

const server = http.createServer((req, res) => {
  const { headers, method, url } = req;

  console.log(method, url);

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
