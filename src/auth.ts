import { insertUserData, getUserHash, getUserInfo, insertSession, deleteSession } from "./database";
import { randomBytes } from "node:crypto";
import { ServerResponse, IncomingMessage } from "node:http";
import { MAX_BODY_SIZE, parseCookie, hashedPwd, User, hashPassword } from "./helpers";

export async function handleRegistrationQuery(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
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

export async function handleLoginQuery(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
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

        const sessionID = randomBytes(32).toString("hex");
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

export function invalidateUserSession(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  const cookies = parseCookie(req.headers.cookie);
  const sessionID = cookies["session_id"];

  if (!sessionID) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Already logged out or unauthorized.");
    return;
  }

  try {
    deleteSession.run(sessionID);

    res.writeHead(200, {
      "Set-Cookie": "session_id=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      "Content-Type": "text/plain",
    });
    res.end("Logged out successfully");
  } catch (err) {
    console.error("Logout error: ", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
}
