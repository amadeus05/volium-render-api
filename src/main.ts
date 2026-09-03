import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { RendererCompositionRoot } from "./composition/renderer-composition-root.ts";
import { HealthProbe } from "./presentation/http/health.probe.ts";

const port = Number(process.env.PORT ?? 8000);
const host = process.env.HOST ?? "0.0.0.0";
const secret = process.env.RENDERER_SECRET ?? "dev-secret";
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`;
const app = new RendererCompositionRoot(secret, publicBaseUrl);
const health = new HealthProbe();

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://local").pathname;

  if (pathname === "/health") {
    health.handle(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/render") {
    void app.controller.handle(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/klines") {
    void app.klines.handle(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/events") {
    void app.events.handle(req, res);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/charts/")) {
    const fileName = path.basename(pathname);
    const filePath = path.join(app.chartsDir, fileName);
    if (!fileName.endsWith(".png") || !existsSync(filePath)) {
      res.writeHead(404).end("not found");
      return;
    }

    res.writeHead(200, { "content-type": "image/png" });
    createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404).end("not found");
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ msg: "http listen", addr: `${host}:${port}` }));
});
