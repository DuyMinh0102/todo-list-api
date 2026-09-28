import { readFile } from "node:fs";
import {
  handleAddTaskQuery,
  handleGetTasksQuery,
  handleDeleteTaskQuery,
  markTaskAsDone,
  editTaskDescription,
} from "./tasksQuery.js";
import { handleRegistrationQuery, handleLoginQuery, invalidateUserSession } from "./auth";
import { join } from "node:path";
import { ServerResponse, IncomingMessage, createServer } from "node:http";

const PORT = Number(process.env.PORT) || 8080;
const HOST = "localhost";

const IS_TEST = process.env.NODE_ENV === "test";

const logs = new Map();
const RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 10,
  endpoints: {
    "/login": { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    "/register": { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  },
} as const;
const WINDOW_SIZE = 60 * 1000;
const MAX_REQUESTS = 10;

const STATIC_ROUTES: Record<string, { file: string; mime: string }> = {
  "/": { file: "html/login.html", mime: "text/html; charset=utf-8" },
  "/login": { file: "html/login.html", mime: "text/html; charset=utf-8" },
  "/register": { file: "html/register.html", mime: "text/html; charset=utf-8" },
  "/home": { file: "html/index.html", mime: "text/html; charset=utf-8" },
  "/css/login.css": { file: "css/login.css", mime: "text/css; charset=utf-8" },
  "/css/main.css": { file: "css/main.css", mime: "text/css; charset=utf-8" },
  "/javascripts/login_check.js": { file: "javascripts/login_check.js", mime: "text/javascript; charset=utf-8" },
  "/javascripts/register_check.js": { file: "javascripts/register_check.js", mime: "text/javascript; charset=utf-8" },
  "/javascripts/index.js": { file: "javascripts/index.js", mime: "text/javascript; charset=utf-8" },
};

function serveStatic(url: string | null | undefined, res: ServerResponse<IncomingMessage>): boolean {
  if (!url) return false;

  const route = STATIC_ROUTES[url];
  if (!route) return false;

  const filePath = join(process.cwd(), "public", route.file);
  readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": route.mime,
      "X-Content-Type-Options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    });
    res.end(content);
  });

  return true;
}

function slidingWindowLog(req: IncomingMessage, res: ServerResponse<IncomingMessage>): boolean {
  if (IS_TEST) return true;

  const ip = req.socket.remoteAddress;
  const now = Date.now();

  let timestamps = (logs.get(ip) || []).filter((ts: number) => now - ts < WINDOW_SIZE);
  timestamps.push(now);

  logs.set(ip, timestamps);

  if (timestamps.length > MAX_REQUESTS) {
    const retryAfter = Math.ceil((timestamps[0] + WINDOW_SIZE - now) / 1000);
    res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(retryAfter) });
    res.end(JSON.stringify({ error: "Too Many Requests", retryAfter }));
    return false;
  } else return true;
}

const server = createServer((req, res) => {
  const { headers, method, url } = req;

  if (serveStatic(url, res)) return;
  if (!slidingWindowLog(req, res)) return;

  const normalizedURL = url?.replace(/\/\d+$/, "/:id");
  const taskID = url?.split("/").pop();

  switch (`${method} ${normalizedURL}`) {
    case "GET /api/tasks":
      handleGetTasksQuery(req, res);
      break;

    case "POST /api/login":
      handleLoginQuery(req, res);

      break;

    case "POST /api/register":
      handleRegistrationQuery(req, res);
      break;

    case "POST /api/tasks":
      handleAddTaskQuery(req, res);
      break;

    case "PUT /api/tasks/:id":
      markTaskAsDone(req, res, taskID);
      break;

    case "PATCH /api/tasks/:id":
      editTaskDescription(req, res, taskID);
      break;

    case "DELETE /api/sessions":
      invalidateUserSession(req, res);
      break;

    case "DELETE /api/tasks/:id":
      handleDeleteTaskQuery(req, res, taskID);
      break;

    default:
      res.statusCode = 404;
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      break;
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of logs) {
    const fresh = timestamps.filter((ts: number) => now - ts < WINDOW_SIZE);
    fresh.length ? logs.set(ip, fresh) : logs.delete(ip);
  }
}, WINDOW_SIZE);

server.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
