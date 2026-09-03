import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";

const PORT = Number(process.env.PORT) || 3000;
const HOST = "localhost";

const server = http.createServer((req, res) => {
  if (req.url === "/submit-form") {
  } else if (
    req.method === "GET" &&
    (req.url === "/" || req.url === "/login")
  ) {
    const filePath = path.join(process.cwd(), "public", "pages", "login.html");

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error: Unable to load page");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(content);
    });
  } else if (req.method === "GET" && req.url === "/register") {
    const filePath = path.join(
      process.cwd(),
      "public",
      "pages",
      "register.html",
    );

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error: Unable to load page");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(content);
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
