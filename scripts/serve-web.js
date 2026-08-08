// Minimal static file server for build/web — avoids depending on `python`
// vs `python3` naming differences between local Windows dev and CI's Ubuntu
// runners; Node is already a hard requirement of this project either way.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "build", "web");
const PORT = process.env.WEB_PORT ? Number(process.env.WEB_PORT) : 8765;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".wasm": "application/wasm",
};

http
  .createServer((req, res) => {
    let filePath = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (req.url === "/" || !path.extname(filePath)) filePath = path.join(ROOT, "index.html");

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`Serving build/web on http://localhost:${PORT}`));
