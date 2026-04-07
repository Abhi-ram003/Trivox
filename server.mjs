import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { generateChatCompletion, getPublicConfig, verifySupabaseUser } from "./lib/chat.js";

const rootDir = process.cwd();
const publicDir = join(rootDir, "public");
loadEnv(join(rootDir, ".env"));

const PORT = Number(process.env.PORT || 3000);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendJson(res, 400, { error: "Missing request URL." });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, getPublicConfig(process.env));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const supabaseUrl = process.env.SUPABASE_URL || "";
      const supabaseAnonKey =
        process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
      const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim() || "";

      const user = await verifySupabaseUser({
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
      }).catch(() => null);

      if (!user) {
        sendJson(res, 401, { error: "Authentication required." });
        return;
      }

      const body = await readJson(req);
      const mode = String(body.mode || "chat");
      const prompt = String(body.prompt || "").trim();
      const history = Array.isArray(body.history) ? body.history : [];

      if (!prompt) {
        sendJson(res, 400, { error: "Prompt is required." });
        return;
      }

      try {
        const completion = await generateChatCompletion({
          env: process.env,
          mode,
          prompt,
          history,
        });

        sendJson(res, 200, completion);
      } catch (error) {
        sendJson(res, error.statusCode || 500, {
          error: error.message || "NVIDIA API request failed.",
          raw: error.payload || null,
        });
      }

      return;
    }

    if (req.method === "GET") {
      serveStatic(res, url.pathname);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
});

server.listen(PORT, () => {
  console.log(`Trivox running at http://localhost:${PORT}`);
});

function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const normalizedPath = normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const relativePath = normalizedPath.replace(/^[/\\]+/, "");
  const filePath = join(publicDir, relativePath);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    sendText(res, 404, "Not found.");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "text/plain; charset=utf-8";
  const fileContents = readFileSync(filePath);

  res.writeHead(200, { "Content-Type": contentType });
  res.end(fileContents);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}
