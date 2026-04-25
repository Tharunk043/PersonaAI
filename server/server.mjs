// server/server.mjs
import express from "express";
import cors from "cors";
import "dotenv/config";
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import Groq from 'groq-sdk';
import { User, Persona, ChatSession, ChatMessage } from './models.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

const PORT   = process.env.PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || "persona-studio-secret-change-me";

// ═══════════════════════════════════════════════════════════════
// MongoDB database setup
// ═══════════════════════════════════════════════════════════════
let dbConnected = false;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    dbConnected = true;
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    dbConnected = false;
  });

// ── Auth helpers ──
function generateToken(user) {
  return jwt.sign({ id: user.id || user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
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

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    const token = generateToken(user);

    return res.json({ user: { id: user._id, name: user.name, email: user.email }, token });
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

    // Mock login for local testing if DB is down
    if (!dbConnected) {
      console.log("[Auth] DB is down, using mock login for:", email);
      const mockUser = { _id: "mock_id", name: "Tharun (Mock)", email };
      const token = generateToken(mockUser);
      return res.json({ user: mockUser, token });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user);
    return res.json({ user: { id: user._id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ user: { id: req.user.id, name: "Tharun (Mock)", email: req.user.email, created_at: new Date() } });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user: { id: user._id, name: user.name, email: user.email, created_at: user.createdAt } });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

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

// ── Personas routes ──
app.post("/api/personas", authenticateToken, async (req, res) => {
  try {
    const { name, prompt, description } = req.body || {};
    if (!name || !prompt) {
      return res.status(400).json({ error: "Name and prompt are required" });
    }

    const slug = generateSlug(name);
    const persona = await Persona.create({
      slug,
      userId: req.user.id,
      name: name.slice(0, 100),
      prompt,
      description: (description || "").slice(0, 500)
    });

    return res.json({ persona: { id: persona._id, slug: persona.slug, name: persona.name, description: persona.description, created_at: persona.createdAt } });
  } catch (err) {
    console.error("[Personas] Create error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/personas", authenticateToken, async (req, res) => {
  try {
    const personas = await Persona.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ personas: personas.map(p => ({ id: p._id, slug: p.slug, name: p.name, description: p.description, created_at: p.createdAt })) });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/personas/:slug", async (req, res) => {
  try {
    const persona = await Persona.findOne({ slug: req.params.slug, isPublic: true }).populate("userId", "name");
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    return res.json({ 
      persona: { 
        id: persona._id, 
        slug: persona.slug, 
        name: persona.name, 
        prompt: persona.prompt, 
        description: persona.description, 
        created_at: persona.createdAt, 
        creator_name: persona.userId?.name 
      } 
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/personas/:id", authenticateToken, async (req, res) => {
  try {
    const persona = await Persona.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Chat routes ──
app.get("/api/chat-sessions", authenticateToken, async (req, res) => {
  try {
    const query = { userId: new mongoose.Types.ObjectId(String(req.user.id)) };
    if (req.query.type) query.type = req.query.type;

    const sessions = await ChatSession.aggregate([
      { $match: query },
      { $lookup: { from: 'chatmessages', localField: '_id', foreignField: 'sessionId', as: 'messages' } },
      { $addFields: { message_count: { $size: '$messages' } } },
      { $project: { messages: 0 } },
      { $sort: { updatedAt: -1 } }
    ]);

    return res.json({ 
      sessions: sessions.map(s => ({ 
        id: s._id, 
        persona_id: s.personaId, 
        title: s.title, 
        persona_prompt: s.personaPrompt,
        type: s.type,
        metadata: s.metadata,
        created_at: s.createdAt, 
        updated_at: s.updatedAt, 
        message_count: s.message_count 
      })) 
    });
  } catch (err) {
    console.error("[Chat] List sessions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/chat-sessions", authenticateToken, async (req, res) => {
  try {
    const { title, personaPrompt, personaId, type, metadata } = req.body || {};
    if (!personaPrompt && type !== 'debate') {
        return res.status(400).json({ error: "Persona prompt is required for chat sessions" });
    }

    let linkedPersonaId = null;
    if (personaId) {
      const persona = await Persona.findOne({ _id: personaId, userId: req.user.id });
      if (persona) linkedPersonaId = persona._id;
    }

    const sessionTitle = String(title || "New session").trim().slice(0, 120) || "New session";
    const session = await ChatSession.create({
      userId: req.user.id,
      personaId: linkedPersonaId,
      title: sessionTitle,
      personaPrompt: String(personaPrompt || ""),
      type: type || 'chat',
      metadata: metadata || {}
    });

    return res.json({ 
      session: { 
        id: session._id, 
        persona_id: session.personaId, 
        title: session.title, 
        persona_prompt: session.personaPrompt, 
        type: session.type,
        metadata: session.metadata,
        created_at: session.createdAt, 
        updated_at: session.updatedAt 
      }, 
      messages: [] 
    });
  } catch (err) {
    console.error("[Chat] Create session error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/chat-sessions/:id", authenticateToken, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user.id });
    if (!session) return res.status(404).json({ error: "Chat session not found" });

    const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 });

    return res.json({ 
      session: { 
        id: session._id, 
        persona_id: session.personaId, 
        title: session.title, 
        persona_prompt: session.personaPrompt, 
        type: session.type,
        metadata: session.metadata,
        created_at: session.createdAt, 
        updated_at: session.updatedAt 
      }, 
      messages: messages.map(m => ({ id: m._id, role: m.role, content: m.content, created_at: m.createdAt }))
    });
  } catch (err) {
    console.error("[Chat] Get session error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/chat-sessions/:id/messages", authenticateToken, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user.id });
    if (!session) return res.status(404).json({ error: "Chat session not found" });

    const { role, content } = req.body || {};
    if (!["user", "assistant", "system"].includes(role) || !content || !String(content).trim()) {
      return res.status(400).json({ error: "Valid role and content are required" });
    }

    const m = await ChatMessage.create({
      sessionId: session._id,
      role,
      content: String(content)
    });

    session.updatedAt = new Date();
    await session.save();

    return res.json({ message: { id: m._id, role: m.role, content: m.content, created_at: m.createdAt } });
  } catch (err) {
    console.error("[Chat] Save message error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/chat-sessions/:id", authenticateToken, async (req, res) => {
  try {
    const session = await ChatSession.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!session) return res.status(404).json({ error: "Chat session not found" });
    await ChatMessage.deleteMany({ sessionId: session._id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ── Groq / Decision Helper ──
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

app.get("/api2/ping", (_req, res) => res.json({ ok: true, at: Date.now(), groqReady: !!groq }));

app.post("/api2/ask", async (req, res) => {
  const { prompt, messages: history } = req.body || {};
  if (!prompt && (!history || !history.length)) {
    return res.status(400).json({ error: "No prompt or messages provided" });
  }
  if (!groq) {
    return res.status(500).json({ error: "Groq API key not configured on server" });
  }

  const messages = history || [
    { role: "system", content: "You are a decision helper. Respond clearly and logically." },
    { role: "user", content: prompt },
  ];

  // Fallback model chain — try multiple models in sequence
  const MODELS = [
    "llama-3.3-70b-versatile",
    "llama3-8b-8192",
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
  ];

  let lastError = null;
  for (const model of MODELS) {
    try {
      const chat = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 1024,
      });
      const answer = chat.choices?.[0]?.message?.content;
      if (!answer) throw new Error("Empty response from model");
      return res.json({ answer, model });
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.statusCode;
      const msg = err?.message || String(err);
      console.error(`[Groq] Model ${model} failed (${status}): ${msg}`);
      // Only try next model on rate-limit (429) or service unavailable (503/500)
      if (status !== 429 && status !== 503 && status !== 500) break;
    }
  }

  const errMsg = lastError?.error?.message || lastError?.message || "Failed to get response from AI";
  const errStatus = lastError?.status || lastError?.statusCode || 500;
  console.error("[Groq] All models failed. Last error:", lastError);
  return res.status(errStatus >= 400 && errStatus < 600 ? errStatus : 500).json({
    error: errMsg,
  });
});

// ═══════════════════════════════════════════════════════════════
// Media Generation Logic (HeyGen, Pexels, etc)
// ═══════════════════════════════════════════════════════════════
const HEYGEN = "https://api.heygen.com";
const API_KEY = process.env.HEYGEN_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const HF_TOKEN = process.env.HF_API_TOKEN || "";
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN || "";
const FAL_KEY = process.env.FAL_KEY || "";

const DEFAULT_AVATAR_ID = process.env.DEFAULT_HEYGEN_AVATAR_ID || null;
const DEFAULT_VOICE_ID  = process.env.DEFAULT_HEYGEN_VOICE_ID  || null;

const ETHEREAL_WALKING_CLIPS = [
  "https://videos.pexels.com/video-files/3822765/3822765-hd_1920_1080_24fps.mp4",
  "https://videos.pexels.com/video-files/9278563/9278563-uhd_2560_1440_30fps.mp4",
  "https://videos.pexels.com/video-files/6772137/6772137-hd_1920_1080_30fps.mp4",
  "https://videos.pexels.com/video-files/7132289/7132289-hd_2048_1080_30fps.mp4",
];

const CLIPS = [
  { kw: ["ocean","sea","beach","waves","coast","water","surf"], url: "https://videos.pexels.com/video-files/3822765/3822765-hd_1920_1080_24fps.mp4" },
  { kw: ["city","street","urban","neon","night","traffic","skyline","downtown"], url: "https://videos.pexels.com/video-files/9278563/9278563-uhd_2560_1440_30fps.mp4" },
  { kw: ["forest","mountain","nature","river","waterfall","himalaya","trees","green"], url: "https://videos.pexels.com/video-files/6772137/6772137-hd_1920_1080_30fps.mp4" },
  { kw: ["fire","smoke","storm","lightning","thunder","rain","volcano"], url: "https://videos.pexels.com/video-files/3326168/3326168-hd_1920_1080_24fps.mp4" },
  { kw: ["tech","technology","code","coding","programming","ai","hud","matrix","neural"], url: "https://videos.pexels.com/video-files/3129957/3129957-uhd_2560_1440_25fps.mp4" },
  { kw: ["cat","dog","animal","bird","wildlife","pet","kitten","puppy"], url: "https://videos.pexels.com/video-files/4206587/4206587-uhd_2560_1440_30fps.mp4" },
  { kw: ["space","galaxy","stars","nebula","astronomy","cosmos"], url: "https://videos.pexels.com/video-files/853800/853800-hd_1920_1080_25fps.mp4" },
  { kw: ["desert","sand","dune","camel"], url: "https://videos.pexels.com/video-files/3815340/3815340-hd_1920_1080_24fps.mp4" },
  { kw: ["snow","ice","winter","glacier"], url: "https://videos.pexels.com/video-files/5248232/5248232-hd_1920_1080_24fps.mp4" },
];

const DEFAULT_DEMO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

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

function bestPexelsFile(video) {
  const files = Array.isArray(video?.video_files) ? video.video_files : [];
  const mp4s = files.filter(f => (f?.file_type || "").toLowerCase().includes("mp4"));
  if (mp4s.length === 0) return null;
  mp4s.sort((a,b) => (b.height||0) - (a.height||0));
  return mp4s[0]?.link || mp4s[0]?.file || null;
}

async function getSearchKeywords(prompt) {
  if (!groq || !prompt || prompt.length < 5) return prompt;
  try {
    const chat = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "Extract 2-3 essential search keywords from the prompt for a stock video search. Return ONLY the keywords separated by spaces." },
        { role: "user", content: prompt }
      ],
      max_tokens: 20
    });
    return chat.choices?.[0]?.message?.content?.trim() || prompt;
  } catch (err) {
    console.error("[Keywords] LLM failed:", err.message);
    return prompt;
  }
}

async function pexelsSearchClip(prompt, orientation = "landscape") {
  if (!PEXELS_KEY) return null;
  try {
    const keywords = await getSearchKeywords(prompt);
    console.log(`[Pexels] Searching for keywords: "${keywords}" (${orientation}) (original: "${prompt}")`);
    const q = encodeURIComponent(keywords || "nature");
    const url = `https://api.pexels.com/videos/search?query=${q}&per_page=5&orientation=${orientation}`;
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

app.get("/api/health", (_req, res) => res.json({ ok: true, pexels: !!PEXELS_KEY, heygen: !!API_KEY, hf: !!HF_TOKEN, replicate: !!REPLICATE_TOKEN }));

app.post("/api/memorial-video", async (req, res) => {
  const { image, scenarioId, prompt, personName } = req.body || {};
  if (!image) return res.status(400).json({ error: "Image is required" });
  
  try {
    const videoUrl = ETHEREAL_WALKING_CLIPS[Math.floor(Math.random() * ETHEREAL_WALKING_CLIPS.length)];
    return res.json({ videoUrl, isEthereal: true, provider: "iconic-walking" });
  } catch (err) {
    const fallbackUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);
    return res.json({ videoUrl: fallbackUrl, isHybrid: true, provider: "pexels-hybrid" });
  }
});

app.post("/api/generate-video", async (req, res) => {
  console.log("[VideoGen] POST request received. Body keys:", Object.keys(req.body || {}));
  const { prompt, avatar_id, voice_id, dimension, provider, aspectRatio } = req.body || {};
  if (!prompt || String(prompt).trim().length < 2) {
    return res.status(400).json({ error: "Prompt/script is required" });
  }

  // Aspect Ratio Mapping
  let orientation = "landscape";
  if (aspectRatio === "9:16") orientation = "portrait";
  else if (aspectRatio === "1:1") orientation = "square";

  if (provider === "web" || provider === "demo") {
    const webUrl = (await pexelsSearchClip(prompt, orientation)) || pickFromMap(prompt);
    return sendDemo(res, webUrl, PEXELS_KEY ? "web-pexels" : "web-map");
  }

  // Fal.ai Video Generation (Luma, Pika, Runway, etc.)
  if (["luma", "pika", "runway", "veo"].includes(provider)) {
    if (!FAL_KEY) {
      const webUrl = (await pexelsSearchClip(prompt, orientation)) || pickFromMap(prompt);
      return sendDemo(res, webUrl, "no-fal-key-web");
    }

    try {
      // Map provider to fal model
      const modelMap = {
        luma: "fal-ai/luma-dream-machine",
        pika: "fal-ai/pika",
        runway: "fal-ai/kling-video/v1.6/standard/text-to-video",
        veo: "fal-ai/luma-dream-machine", // fallback
      };
      const model = modelMap[provider] || "fal-ai/luma-dream-machine";
      
      console.log(`[FalAI] Generating with ${model} for prompt: ${prompt} (${aspectRatio})`);
      const r = await fetch(`https://fal.run/${model}`, {
        method: "POST",
        headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt,
          aspect_ratio: aspectRatio || "16:9"
        })
      });

      if (!r.ok) throw new Error(`Fal error ${r.status}`);
      const data = await r.json();
      
      // Some fal models return a request_id for polling, some return video.url immediately
      if (data.video?.url) {
        return sendDemo(res, data.video.url, `fal-${provider}`);
      } else if (data.request_id) {
        return res.json({ jobId: data.request_id, provider: "fal" });
      }
      throw new Error("No video URL or request ID from Fal");
    } catch (e) {
      console.error("[FalAI] Error:", e.message);
      const webUrl = (await pexelsSearchClip(prompt, orientation)) || pickFromMap(prompt);
      return sendDemo(res, webUrl, `fal-fail-web: ${e.message}`);
    }
  }

  if (!API_KEY) {
    const webUrl = (await pexelsSearchClip(prompt, orientation)) || pickFromMap(prompt);
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
    video_inputs: [{ avatar_id: useAvatar, voice_id: useVoice, input_text: String(prompt) }],
    dimension: dim,
  };

  try {
    const r = await fetch(`${HEYGEN}/v2/video/generate`, http({ method: "POST", body: payload }));
    if (!r.ok) {
      const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);
      return sendDemo(res, webUrl, `heygen-create-${r.status}-web`);
    }
    const body = await r.json();
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

app.get("/api/generate-video", async (req, res) => {
  try {
    const jobId = req.query.jobId;
    if (!jobId) return sendDemo(res, DEFAULT_DEMO_URL, "no-jobid-web");
    if (!API_KEY && !FAL_KEY) return sendDemo(res, DEFAULT_DEMO_URL, "no-keys-web");

    // Handle Fal polling if needed
    if (jobId.includes("-") || jobId.length > 20) {
      try {
        const r = await fetch(`https://fal.run/requests/${jobId}`, {
          headers: { "Authorization": `Key ${FAL_KEY}` }
        });
        if (!r.ok) throw new Error(`Fal status error ${r.status}`);
        const data = await r.json();
        const statusMap = { "IN_PROGRESS": "running", "COMPLETED": "succeeded", "FAILED": "failed", "IN_QUEUE": "queued" };
        const status = statusMap[data.status] || "running";
        
        return res.json({
          status,
          url: data.payload?.video?.url || data.payload?.url,
          progress: status === "succeeded" ? 100 : (status === "running" ? 50 : 10),
          message: data.status
        });
      } catch (e) {
        console.error("[Fal Polling] Error:", e.message);
        // fall through to heygen or return error
      }
    }

    const r = await fetch(`${HEYGEN}/v2/video/status?video_id=${encodeURIComponent(jobId)}`, http());
    if (!r.ok) return sendDemo(res, DEFAULT_DEMO_URL, `heygen-status-${r.status}-web`);

    const body = await r.json();
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
  console.log(`🎬 Server ready on http://localhost:${PORT} | MongoDB: Connected`);
  
  // Keep-alive ping logic
  const URL = "https://persona-ai-backend-d69i.onrender.com/api/health";
  setInterval(() => {
    fetch(URL)
      .then(() => console.log(`💓 Keep-alive ping sent to ${URL}`))
      .catch(err => console.error("❌ Keep-alive ping failed:", err.message));
  }, 600000); // 10 minutes
});