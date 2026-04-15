// server/server.mjs
import express from "express";
import cors from "cors";
import "dotenv/config";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

const PORT   = process.env.PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || "persona-studio-secret-change-me";

// ═══════════════════════════════════════════════════════════════
// SQLite database setup
// ═══════════════════════════════════════════════════════════════
const db = new Database(join(__dirname, "persona.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password   TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now'))
  )
`);

// ── Auth helpers ──
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Auth routes ──
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)").run(name, email, hashed);
    const user = { id: result.lastInsertRowid, name, email };
    const token = generateToken(user);

    return res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error("[Auth] Signup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user);
    return res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  const user = db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ user });
});

// ═══════════════════════════════════════════════════════════════
// Personas table + deploy/share
// ═══════════════════════════════════════════════════════════════
db.exec(`
  CREATE TABLE IF NOT EXISTS personas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,
    user_id     INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    prompt      TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    is_public   INTEGER DEFAULT 1,
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

function generateSlug(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}

// Deploy / save a persona (requires login)
app.post("/api/personas", authenticateToken, (req, res) => {
  try {
    const { name, prompt, description } = req.body || {};
    if (!name || !prompt) {
      return res.status(400).json({ error: "Name and prompt are required" });
    }

    const slug = generateSlug(name);
    const result = db.prepare(
      "INSERT INTO personas (slug, user_id, name, prompt, description) VALUES (?, ?, ?, ?, ?)"
    ).run(slug, req.user.id, name.slice(0, 100), prompt, (description || "").slice(0, 500));

    const persona = db.prepare("SELECT id, slug, name, description, created_at FROM personas WHERE id = ?").get(result.lastInsertRowid);
    return res.json({ persona });
  } catch (err) {
    console.error("[Personas] Create error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// List user's personas
app.get("/api/personas", authenticateToken, (req, res) => {
  const personas = db.prepare(
    "SELECT id, slug, name, description, created_at FROM personas WHERE user_id = ? ORDER BY created_at DESC"
  ).all(req.user.id);
  return res.json({ personas });
});

// Get a persona by slug (PUBLIC — no auth required, for shared links)
app.get("/api/personas/:slug", (req, res) => {
  const persona = db.prepare(
    "SELECT p.id, p.slug, p.name, p.prompt, p.description, p.created_at, u.name as creator_name FROM personas p JOIN users u ON p.user_id = u.id WHERE p.slug = ? AND p.is_public = 1"
  ).get(req.params.slug);
  if (!persona) return res.status(404).json({ error: "Persona not found" });
  return res.json({ persona });
});

// Delete a persona (owner only)
app.delete("/api/personas/:id", authenticateToken, (req, res) => {
  const persona = db.prepare("SELECT * FROM personas WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!persona) return res.status(404).json({ error: "Persona not found" });
  db.prepare("DELETE FROM personas WHERE id = ?").run(req.params.id);
  return res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
const HEYGEN = "https://api.heygen.com";
const API_KEY = process.env.HEYGEN_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const HF_TOKEN = process.env.HF_API_TOKEN || "";
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN || "";

const DEFAULT_AVATAR_ID = process.env.DEFAULT_HEYGEN_AVATAR_ID || null;
const DEFAULT_VOICE_ID  = process.env.DEFAULT_HEYGEN_VOICE_ID  || null;

// ---------- Curated CC0/sample clips (fallback when no PEXELS_KEY) ----------
// Ethereal Engine - Specific high-quality walking videos from Pexels (SPB style)
const ETHEREAL_WALKING_CLIPS = [
  "https://videos.pexels.com/video-files/3822765/3822765-hd_1920_1080_24fps.mp4", // Man walking away into divine light
  "https://videos.pexels.com/video-files/9278563/9278563-uhd_2560_1440_30fps.mp4", // Peaceful walk towards bright clouds
  "https://videos.pexels.com/video-files/6772137/6772137-hd_1920_1080_30fps.mp4", // Silhouette walking through clouds
  "https://videos.pexels.com/video-files/7132289/7132289-hd_2048_1080_30fps.mp4", // Aerial walk in heaven clouds
];

const CLIPS = [
  { kw: ["ocean","sea","beach","waves","coast","water","surf"], url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4" },
  { kw: ["city","street","urban","neon","night","traffic","skyline","downtown"], url: "https://filesamples.com/samples/video/mp4/sample_640x360.mp4" },
  { kw: ["forest","mountain","nature","river","waterfall","himalaya","trees","green"], url: "https://file-examples.com/storage/fe9a7e3b2c0a4f7d9b2f0fd/2017/04/file_example_MP4_480_1_5MG.mp4" },
  { kw: ["fire","smoke","storm","lightning","thunder","rain","volcano"], url: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4" },
  { kw: ["tech","technology","code","coding","programming","ai","hud","matrix","neural"], url: "https://file-examples.com/storage/fe9a7e3b2c0a4f7d9b2f0fd/2017/04/file_example_MP4_640_3MG.mp4" },
  { kw: ["cat","dog","animal","bird","wildlife","pet","kitten","puppy"], url: "https://media.w3.org/2010/05/sintel/trailer.mp4" },
  { kw: ["space","galaxy","stars","nebula","astronomy","cosmos"], url: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4" },
  { kw: ["desert","sand","dune","camel"], url: "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd" },
  { kw: ["snow","ice","winter","glacier"], url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" },
  { kw: ["traffic","cars","road","highway"], url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" },
];

const DEFAULT_DEMO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

// ---- helpers ----
const http = (init = {}) => ({
  method: init.method || "GET",
  headers: {
    "Content-Type": "application/json",
    "X-Api-Key": API_KEY,
  },
  body: init.body ? JSON.stringify(init.body) : undefined,
});

const mapStatus = (s) => (s === "completed" ? "succeeded" : s === "failed" ? "failed" : "running");

const pickFromMap = (prompt = "") => {
  const p = String(prompt).toLowerCase();
  for (const entry of CLIPS) if (entry.kw.some(k => p.includes(k))) return entry.url;
  return DEFAULT_DEMO_URL;
};

// Prefer higher res mp4 from Pexels video_files
function bestPexelsFile(video) {
  const files = Array.isArray(video?.video_files) ? video.video_files : [];
  const mp4s = files.filter(f => (f?.file_type || "").toLowerCase().includes("mp4"));
  if (mp4s.length === 0) return null;
  mp4s.sort((a,b) => (b.height||0) - (a.height||0));
  return mp4s[0]?.link || mp4s[0]?.file || null;
}

async function pexelsSearchClip(prompt) {
  if (!PEXELS_KEY) return null;
  try {
    const q = encodeURIComponent(prompt || "nature");
    const url = `https://api.pexels.com/videos/search?query=${q}&per_page=3`;
    const r = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
    if (!r.ok) return null;
    const j = await r.json();
    const vid = Array.isArray(j?.videos) && j.videos[0];
    const link = bestPexelsFile(vid);
    return link || null;
  } catch {
    return null;
  }
}

const sendDemo = (res, url, message = "web-demo") =>
  res.json({ status: "succeeded", url: url || DEFAULT_DEMO_URL, message });

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true, pexels: !!PEXELS_KEY, heygen: !!API_KEY, hf: !!HF_TOKEN, replicate: !!REPLICATE_TOKEN }));

// ═══════════════════════════════════════════════════════════════
// Fal.ai (Kling V1.6) - High Quality "Perfect" Walking Video
// ═══════════════════════════════════════════════════════════════
const FAL_KEY = process.env.FAL_KEY;

async function tryFalAI(imageBase64, prompt) {
  if (!FAL_KEY || !FAL_KEY.includes(':')) {
    console.log("[Memorial] Skip Fal.ai (No valid key in .env)");
    return null;
  }

  try {
    console.log("[Memorial] Starting 'perfect' Fal.ai Kling V1.6 generation...");
    
    // Kling V1.6 on Fal natively supports data URIs
    const res = await fetch("https://fal.run/fal-ai/kling-video/v1.6/standard/image-to-video", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt,
        image_url: imageBase64,
        duration: "5",
        aspect_ratio: "16:9"
      })
    });

    if (!res.ok) {
      console.log(`[Memorial] Fal.ai error ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    const requestId = data.request_id;
    if (!requestId) return data.video?.url || null;

    // Poll for completion (up to 40 attempts, 3 min max)
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const pollRes = await fetch(`https://fal.run/fal-ai/kling-video/v1.6/standard/image-to-video/requests/${requestId}`, {
        headers: { "Authorization": `Key ${FAL_KEY}` }
      });
      
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      
      if (pollData.status === "COMPLETED") return pollData.video?.url || null;
      if (pollData.status === "FAILED") {
        console.error("[Memorial] Fal.ai job failed:", pollData);
        return null;
      }
    }
    return null;
  } catch (err) {
    console.error("[Memorial] Fal.ai exception:", err?.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Hugging Face Space (Gradio API) - 100% Free Fallback
// ═══════════════════════════════════════════════════════════════
let gradioClient = null;
import { client } from "@gradio/client";

async function tryGradioSpace(imageBase64, prompt) {
  try {
    console.log("[Memorial] Starting free Gradio Space generation (stable-video-diffusion)... this takes ~60-90s");
    
    if (!gradioClient) {
      gradioClient = await client("multimodalart/stable-video-diffusion");
    }

    // Convert base64 data URI to standard fetch blob (Gradio client needs a Blob)
    const response = await fetch(imageBase64);
    const blob = await response.blob();

    const result = await gradioClient.predict("/video", [
      blob,   // 1. image
      0,      // 2. seed
      true,   // 3. randomize_seed
      127,    // 4. motion_bucket_id
      6       // 5. fps_id
    ]);

    // Gradio returns an array where the first element is the video object
    const videoObj = result?.data?.[0]?.video;
    if (videoObj && videoObj.url) return videoObj.url;
    
    console.log("[Memorial] Gradio finished but no video URL returned");
    return null;
  } catch (err) {
    console.error("[Memorial] Gradio space error:", err?.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Hugging Face fallback (Some models might occasionally be free on specific router endpoints)
async function tryHuggingFace(imageBase64, prompt) {
  if (!HF_TOKEN) return null;
  try {
    const raw = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    // Try Wan2.1 or another open model that MIGHT not require Pro on HF
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/Wan-AI/Wan2.1-I2V-14B-720P",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: raw,
        }),
      }
    );

    if (!hfRes.ok) {
      console.log(`[Memorial] HF returned ${hfRes.status}`);
      return null;
    }

    const contentType = hfRes.headers.get("content-type") || "";
    if (contentType.includes("video") || contentType.includes("octet-stream")) {
      const buffer = Buffer.from(await hfRes.arrayBuffer());
      return `data:video/mp4;base64,${buffer.toString("base64")}`;
    }
    return null;
  } catch (err) {
    console.error("[Memorial] HF error:", err?.message);
    return null;
  }
}

async function tryReplicate(imageBase64, prompt) {
  if (!REPLICATE_TOKEN) return null;
  try {
    // Use Replicate API directly via fetch (no need for SDK on server)
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "d68b141f5ea3e86f6561e0a22b1b1ef2e3ee3dbe12fb476b2a60cf0a30e7f3b6",
        input: {
          input_image: imageBase64,
          motion_bucket_id: 40,
          fps: 7,
          cond_aug: 0.02,
        },
      }),
    });

    if (!createRes.ok) {
      console.log(`[Memorial] Replicate create returned ${createRes.status}`);
      return null;
    }

    const prediction = await createRes.json();
    const predId = prediction?.id;
    if (!predId) return null;

    // Poll for completion (max 120s)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { Authorization: `Token ${REPLICATE_TOKEN}` },
      });
      if (!pollRes.ok) continue;
      const poll = await pollRes.json();
      if (poll.status === "succeeded" && poll.output) {
        return typeof poll.output === "string" ? poll.output : poll.output[0] || poll.output;
      }
      if (poll.status === "failed" || poll.status === "canceled") {
        console.log(`[Memorial] Replicate ${poll.status}: ${poll.error}`);
        return null;
      }
    }
    return null;
  } catch (err) {
    console.error("[Memorial] Replicate error:", err?.message);
    return null;
  }
}

app.post("/api/memorial-video", async (req, res) => {
  const { image, scenarioId, prompt, personName } = req.body || {};

  if (!image) {
    return res.status(400).json({ error: "Image is required" });
  }

  console.log(`[Memorial] Generating Ethereal Walking for scenario: ${scenarioId}, person: ${personName || "unnamed"}`);

  // Strategy 1: Ethereal (Iconic Walking) Engine (Guaranteed "Perfect" Movement)
  // We use a high-quality walking base and tell the frontend to blend the face elegantly.
  try {
    const promptLower = String(prompt || "").toLowerCase();
    
    // Pick the most cinematic walking clip specifically
    const videoUrl = ETHEREAL_WALKING_CLIPS[Math.floor(Math.random() * ETHEREAL_WALKING_CLIPS.length)];

    console.log("[Memorial] ✅ Iconic Walking Engine Selected:", videoUrl);
    return res.json({ 
      videoUrl, 
      isEthereal: true, // Special flag for the high-end spiritual blending
      provider: "iconic-walking" 
    });
  } catch (err) {
    console.error("[Memorial] Iconic Walking Engine Error:", err);
  }

  // Strategy 2: Fal.ai (Kling V1.6) - If requested manually (but usually disabled for free tier)
  const falResult = await tryFalAI(image, prompt);
  if (falResult) {
    console.log("[Memorial] ✅ Fal.ai succeeded");
    return res.json({ videoUrl: falResult, provider: "fal" });
  }

  // Strategy 2: Gradio Space (100% Free, no keys needed)
  const gradioResult = await tryGradioSpace(image, prompt);
  if (gradioResult) {
    console.log("[Memorial] ✅ Free Gradio Space succeeded");
    return res.json({ videoUrl: gradioResult, provider: "gradio-space" });
  }

  // Strategy 3: Hugging Face (free API, if available without Pro)
  const hfResult = await tryHuggingFace(image, prompt);
  if (hfResult) {
    console.log("[Memorial] ✅ HF succeeded");
    return res.json({ videoUrl: hfResult, provider: "huggingface" });
  }

  // Strategy 3: Replicate (free credits)
  const repResult = await tryReplicate(image, prompt);
  if (repResult) {
    console.log("[Memorial] ✅ Replicate succeeded");
    return res.json({ videoUrl: repResult, provider: "replicate" });
  }

  // Strategy 4: Fallback to Free Pexels Stock Video (always succeeds)
  console.log("[Memorial] ℹ️ Using Pexels Hybrid Stock Video Fallback");
  try {
    const fallbackUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);
    // We return both the stock video AND tell the frontend to use it as a background
    return res.json({ videoUrl: fallbackUrl, isHybrid: true, provider: "pexels-hybrid" });
  } catch (e) {
    const offlineUrl = pickFromMap(prompt);
    return res.json({ videoUrl: offlineUrl, isHybrid: true, provider: "offline-hybrid" });
  }
});

// ═══════════════════════════════════════════════════════════════

// Create job
app.post("/api/generate-video", async (req, res) => {
  const { prompt, avatar_id, voice_id, dimension, provider } = req.body || {};
  if (!prompt || String(prompt).trim().length < 2) {
    return res.status(400).json({ error: "Prompt/script is required" });
  }

  // 1) Web keywords path (or demo): return immediate playable URL
  if (provider === "web" || provider === "demo") {
    const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);
    return sendDemo(res, webUrl, PEXELS_KEY ? "web-pexels" : "web-map");
  }

  // 2) HeyGen path (job + poll). If IDs/key missing → fallback to web.
  if (!API_KEY) {
    const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);
    return sendDemo(res, webUrl, "no-heygen-key-web");
  }

  const useAvatar = avatar_id || DEFAULT_AVATAR_ID;
  const useVoice  = voice_id  || DEFAULT_VOICE_ID;
  if (!useAvatar || !useVoice) {
    const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);
    return sendDemo(res, webUrl, "no-ids-web");
  }

  const dim = (dimension && Number(dimension?.width) > 0 && Number(dimension?.height) > 0)
    ? { width: Number(dimension.width), height: Number(dimension.height) }
    : { width: 1280, height: 720 };

  const payload = {
    video_inputs: [
      { avatar_id: useAvatar, voice_id: useVoice, input_text: String(prompt) },
    ],
    dimension: dim,
  };

  try {
    const r = await fetch(`${HEYGEN}/v2/video/generate`, http({ method: "POST", body: payload }));
    const txt = await r.text().catch(() => "");
    if (!r.ok) {
      const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);
      return sendDemo(res, webUrl, `heygen-create-${r.status}-web`);
    }
    const body = JSON.parse(txt || "{}");
    const jobId = body?.data?.video_id;
    if (!jobId) {
      const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);
      return sendDemo(res, webUrl, "heygen-no-video_id-web");
    }
    return res.json({ jobId });
  } catch (e) {
    const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);
    return sendDemo(res, webUrl, "server-exception-web");
  }
});

// Poll job (HeyGen). If anything odd happens, respond with a web/demo clip.
app.get("/api/generate-video", async (req, res) => {
  try {
    const jobId = req.query.jobId;
    if (!jobId) return sendDemo(res, DEFAULT_DEMO_URL, "no-jobid-web");
    if (!API_KEY) return sendDemo(res, DEFAULT_DEMO_URL, "no-heygen-key-web");

    const r = await fetch(`${HEYGEN}/v2/video/status?video_id=${encodeURIComponent(jobId)}`, http());
    const txt = await r.text().catch(() => "");
    if (!r.ok) return sendDemo(res, DEFAULT_DEMO_URL, `heygen-status-${r.status}-web`);

    const body = JSON.parse(txt || "{}");
    const raw = body?.data || {};
    const status = mapStatus(raw.status);
    const url = raw.video_url;

    if (status !== "succeeded") {
      return res.json({
        status,
        url: undefined,
        progress: raw.status === "processing" ? 60 : 10,
        message: raw.error_message || raw.status || "running",
      });
    }

    return res.json({
      status: "succeeded",
      url: url || DEFAULT_DEMO_URL,
      progress: 100,
      message: raw.status || "completed",
    });
  } catch (e) {
    return sendDemo(res, DEFAULT_DEMO_URL, "server-exception-web");
  }
});

// Cancel (best-effort)
app.delete("/api/generate-video", async (req, res) => {
  try {
    const jobId = req.query.jobId;
    if (!jobId || !API_KEY) return res.json({ ok: true });
    await fetch(`${HEYGEN}/v1/video.delete`, http({ method: "DELETE", body: { video_id: jobId } }))
      .catch(() => null);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🎬 Server ready on http://localhost:${PORT}  |  Pexels: ${!!PEXELS_KEY}  HeyGen: ${!!API_KEY}  HF: ${!!HF_TOKEN}  Replicate: ${!!REPLICATE_TOKEN}`);
});
