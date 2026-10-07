import { authRouter } from "./routes/auth";
import { taskRouter } from "./routes/tasks";
import express, { NextFunction, type Express, type Request, type Response } from "express";

const IS_TEST = process.env.NODE_ENV === "test";
const PORT = Number(process.env.PORT) || 8080;

const app: Express = express();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 10,
  endpoints: {
    "/login": { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    "/register": { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  },
} as const;
const logs = new Map<string, { windowMs: number; timestamps: number[] }>();

function rateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.socket.remoteAddress;
    const now = Date.now();
    const key = `${ip}:${req.baseUrl}${req.path}`;

    const entry = logs.get(key) || { windowMs: config.windowMs, timestamps: [] };
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < config.windowMs);
    entry.timestamps.push(now);
    logs.set(key, entry);

    if (entry.timestamps.length > config.maxRequests) {
      const retryAfter = Math.ceil((entry.timestamps[0] + config.windowMs - now) / 1000);
      res.status(429).json({ error: "Too Many Requests", retryAfter });
      return;
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of logs) {
    const fresh = entry.timestamps.filter((ts) => now - ts < entry.windowMs);
    fresh.length ? (entry.timestamps = fresh) : logs.delete(key);
  }
}, 60 * 1000);

app.use("/api/login", rateLimiter(RATE_LIMIT.endpoints["/login"]));
app.use("/api/register", rateLimiter(RATE_LIMIT.endpoints["/register"]));

app.use("/api", rateLimiter({ windowMs: RATE_LIMIT.windowMs, maxRequests: RATE_LIMIT.maxRequests }));

app.use(
  express.static("public", {
    setHeaders: (res, path) => {
      if (path.endsWith(".html")) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      }
    },
  }),
);

app.use("/api", authRouter);
app.use("/api/tasks", taskRouter);

app.listen(PORT, () => {
  console.log(`Server on: ${PORT}`);
});
