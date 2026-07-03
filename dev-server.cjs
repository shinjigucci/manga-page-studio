const fs = require("fs");
const http = require("http");
const path = require("path");

const root = __dirname;
loadEnvFile(path.join(root, ".env"));
const port = Number(process.env.PORT || 4177);
const host = process.env.HOST || "0.0.0.0";
const openAiModel = process.env.OPENAI_MODEL || "gpt-5.5";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
};

http
  .createServer(async (req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0] || "/");

    if (req.method === "POST" && urlPath === "/api/storyboard") {
      await handleStoryboard(req, res);
      return;
    }

    const filePath = path.join(root, urlPath === "/" ? "index.html" : urlPath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, host, () => {
    console.log(`Manga Page Studio: http://127.0.0.1:${port}`);
  });

async function handleStoryboard(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      sendJson(res, 501, {
        error: "OPENAI_API_KEY is not set. Local generation will be used.",
      });
      return;
    }

    const body = await readJson(req);
    const story = String(body.story || "").trim();
    const characterCount = Number(body.characterCount || 0);
    if (!story) {
      sendJson(res, 400, { error: "Story is required." });
      return;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel,
        reasoning: { effort: "low" },
        instructions: storyboardInstructions(),
        input: [
          {
            role: "user",
            content: JSON.stringify({
              story,
              characterCount,
              requirement: "Create a manga storyboard. The user should only need to provide this story and optional character images.",
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "manga_storyboard",
            strict: true,
            schema: storyboardSchema(),
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      sendJson(res, response.status, {
        error: data?.error?.message || "OpenAI API request failed.",
      });
      return;
    }

    const outputText = extractOutputText(data);
    const storyboard = JSON.parse(outputText);
    sendJson(res, 200, storyboard);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Storyboard generation failed." });
  }
}

function storyboardInstructions() {
  return [
    "You are a professional Japanese manga storyboard director.",
    "Convert the user's story into a page-by-page manga plan.",
    "Write natural, short Japanese dialogue that fits speech bubbles.",
    "Do not merely copy narration. Convert it into character speech, inner monologue, and visual action.",
    "Choose panel counts and layouts automatically based on pacing.",
    "Keep each dialogue under 28 Japanese characters when possible.",
    "Each panel must have a clear scene label, emotion, camera direction, visual description, dialogue, and asset index.",
    "Use assetIndex from 0 to characterCount - 1 when character images exist; otherwise use 0.",
    "Return only JSON that matches the schema.",
  ].join("\n");
}

function storyboardSchema() {
  const panel = {
    type: "object",
    properties: {
      scene: { type: "string" },
      dialogue: { type: "string" },
      narration: { type: "string" },
      emotion: { type: "string" },
      camera: { type: "string" },
      visual: { type: "string" },
      assetIndex: { type: "integer" },
    },
    required: ["scene", "dialogue", "narration", "emotion", "camera", "visual", "assetIndex"],
    additionalProperties: false,
  };

  return {
    type: "object",
    properties: {
      title: { type: "string" },
      logline: { type: "string" },
      pages: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            layout: { type: "string", enum: ["2v", "3stack", "4grid", "cinema"] },
            panels: {
              type: "array",
              minItems: 1,
              maxItems: 4,
              items: panel,
            },
          },
          required: ["layout", "panels"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "logline", "pages"],
    additionalProperties: false,
  };
}

function extractOutputText(data) {
  if (data.output_text) return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("Invalid JSON request."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}
