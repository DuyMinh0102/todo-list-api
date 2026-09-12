import { ServerResponse, IncomingMessage } from "node:http";
import { MAX_BODY_SIZE, parseCookie, User } from "./helpers";
import { getSessionInfo, insertTaskData, getTasks, deleteTask, markAsComplete, updateTask } from "./database";

export async function handleAddTaskQuery(req: IncomingMessage, res: ServerResponse<IncomingMessage>): Promise<void> {
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
        const currentUser = getSessionInfo.get(sessionID) as User | undefined;

        if (!currentUser) {
          res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Unauthorized: Invalid or expired session");
          return;
        }

        insertTaskData.run(taskTitle, taskDesc, currentUser.id, "in-progress");

        res.writeHead(201, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Task added successfully");
      } catch (err) {
        console.error("Task creation error:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });
}

export function handleGetTasksQuery(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
  const cookies = parseCookie(req.headers.cookie);
  const sessionID = cookies["session_id"];

  if (!sessionID) {
    res.statusCode = 401;
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  try {
    const tasks = getTasks.all(sessionID);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(tasks));
  } catch (err) {
    console.error("Fetch tasks error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
}

function checkSessionValidity(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  taskIDStr: string | undefined,
): boolean {
  const taskID = Number(taskIDStr);

  if (!taskID || isNaN(taskID)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Valid task ID is required in the URL.");
    return false;
  }

  const cookies = parseCookie(req.headers.cookie);
  const sessionID = cookies["session_id"];

  if (!sessionID) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized.");
    return false;
  }

  return true;
}

export function handleDeleteTaskQuery(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  taskIDStr: string | undefined,
) {
  if (!checkSessionValidity(req, res, taskIDStr)) return;

  const taskID = Number(taskIDStr);
  const cookies = parseCookie(req.headers.cookie);
  const sessionID = cookies["session_id"];

  try {
    const currentUser = getSessionInfo.get(sessionID) as User | undefined;

    if (!currentUser) {
      res.writeHead(401, { "Content-Type": "text/plain" });
      res.end("Unauthorized: Invalid session");
      return;
    }

    const info = deleteTask.run(taskID, currentUser.id);

    if (info.changes === 0) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Task not found or you do not have permission to delete it");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`Task deleted successfully. ID: ${taskID}`);
  } catch (err) {
    console.error("Delete task error: ", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
}

export function markTaskAsDone(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  taskIDStr: string | undefined,
) {
  if (!checkSessionValidity(req, res, taskIDStr)) return;

  const taskID = Number(taskIDStr);
  const cookies = parseCookie(req.headers.cookie);
  const sessionID = cookies["session_id"];

  try {
    const currentUser = getSessionInfo.get(sessionID) as User | undefined;

    if (!currentUser) {
      res.writeHead(401, { "Content-Type": "text/plain" });
      res.end("Unauthorized: Invalid session");
      return;
    }

    const info = markAsComplete.run(taskID, currentUser.id);

    if (info.changes === 0) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Task not found or you do not have permission to mark it");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`Task marked as completed successfully. ID: ${taskID}`);
  } catch (err) {
    console.error("Mark task error: ", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
}

export async function editTaskDescription(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  taskIDStr: string | undefined,
) {
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

      if (!checkSessionValidity(req, res, taskIDStr)) return;

      const taskID = Number(taskIDStr);
      const cookies = parseCookie(req.headers.cookie);
      const sessionID = cookies["session_id"];

      try {
        const currentUser = getSessionInfo.get(sessionID) as User | undefined;

        if (!currentUser) {
          res.writeHead(401, { "Content-Type": "text/plain" });
          res.end("Unauthorized: Invalid session");
          return;
        }

        const newDesc = parsedBody.get("description");

        const info = updateTask.run(newDesc, taskID, currentUser.id);

        if (info.changes === 0) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Task not found or you do not have permission to mark it");
          return;
        }

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(`Task's description updated successfully. ID: ${taskID}`);
      } catch (err) {
        console.error("Update task error: ", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });
}
