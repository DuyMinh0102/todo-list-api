import { readFile } from "node:fs";
import { handleAddTaskQuery, handleGetTasksQuery, handleDeleteTaskQuery, markTaskAsDone } from "./tasksQuery.js";
import { handleRegistrationQuery, handleLoginQuery, invalidateUserSession } from "./auth";
import { join } from "node:path";
import { ServerResponse, IncomingMessage, createServer } from "node:http";

const PORT = Number(process.env.PORT) || 3000;
const HOST = "localhost";

function returnNeededFile(res: ServerResponse<IncomingMessage>, filename: string, filetype: string): void {
  const filePath = join(process.cwd(), "public", filetype, filename);

  readFile(filePath, (err, content) => {
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

const server = createServer((req, res) => {
  const { headers, method, url } = req;

  const normalizedURL = url?.replace(/\/\d+$/, "/:id");
  const taskID = url?.split("/").pop();

  switch (`${method} ${normalizedURL}`) {
    case "GET /css/login.css":
      returnNeededFile(res, "login.css", "css");
      break;

    case "GET /css/main.css":
      returnNeededFile(res, "main.css", "css");
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

    case "POST /mark-as-done/:id":
      markTaskAsDone(req, res, taskID);
      break;

    case "DELETE /remove-session":
      invalidateUserSession(req, res);
      break;

    case "DELETE /delete-task/:id":
      handleDeleteTaskQuery(req, res, taskID);
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
