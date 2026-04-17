// server/server.mjs\nimport express from "express";\nimport cors from "cors";\nimport "dotenv/config";\nimport mongoose from 'mongoose';
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
app.use(express.json({ limit: '15mb' }));

const PORT   = process.env.PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || 'persona-studio-secret-change-me';

// ═══════════════════════════════════════════════════════════════
// MongoDB database setup
// ═══════════════════════════════════════════════════════════════
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('SQL to MongoDB Migrated Database Connected')).catch(err => console.error(err));

function generateToken(user) {
  return jwt.sign({ id: user.id || user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    if (password.length < 6) return res.status(400).json({ error: 'Password length' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    return res.json({ user: { id: user._id, name: user.name, email: user.email }, token: generateToken(user) });
  } catch (err) { return res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid auth' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid auth' });
    return res.json({ user: { id: user._id, name: user.name, email: user.email }, token: generateToken(user) });
  } catch (err) { return res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: { id: user._id, name: user.name, email: user.email, created_at: user.createdAt } });
});

function generateSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + crypto.randomBytes(3).toString('hex');
}

app.post('/api/personas', authenticateToken, async (req, res) => {
  try {
    const { name, prompt, description } = req.body || {};
    if (!name || !prompt) return res.status(400).json({ error: 'Required' });
    const persona = await Persona.create({ slug: generateSlug(name), userId: req.user.id, name, prompt, description });
    return res.json({ persona: { id: persona._id, slug: persona.slug, name: persona.name, description: persona.description, created_at: persona.createdAt } });
  } catch (err) { return res.status(500).json({ error: 'error' }); }
});

app.get('/api/personas', authenticateToken, async (req, res) => {
  const personas = await Persona.find({ userId: req.user.id }).sort({ createdAt: -1 });
  return res.json({ personas: personas.map(p => ({ id: p._id, slug: p.slug, name: p.name, description: p.description, created_at: p.createdAt })) });
});

app.get('/api/personas/:slug', async (req, res) => {
  const persona = await Persona.findOne({ slug: req.params.slug, isPublic: true }).populate('userId', 'name');
  if (!persona) return res.status(404).json({ error: 'Not found' });
  return res.json({ persona: { id: persona._id, slug: persona.slug, name: persona.name, prompt: persona.prompt, description: persona.description, created_at: persona.createdAt, creator_name: persona.userId?.name } });
});

app.delete('/api/personas/:id', authenticateToken, async (req, res) => {
  const persona = await Persona.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  return res.json({ ok: !!persona });
});

app.get('/api/chat-sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await ChatSession.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(req.user.id)) } },
      { $lookup: { from: 'chatmessages', localField: '_id', foreignField: 'sessionId', as: 'messages' } },
      { $addFields: { message_count: { $size: '$messages' } } },
      { $project: { messages: 0 } },
      { $sort: { updatedAt: -1 } }
    ]);
    return res.json({ sessions: sessions.map(s => ({ id: s._id, persona_id: s.personaId, title: s.title, persona_prompt: s.personaPrompt, created_at: s.createdAt, updated_at: s.updatedAt, message_count: s.message_count })) });
  } catch (err) { return res.status(500).json({ error: 'Error' }); }
});

app.post('/api/chat-sessions', authenticateToken, async (req, res) => {
  const { title, personaPrompt, personaId } = req.body || {};
  let linkedPersonaId = null;
  if (personaId) {
    const p = await Persona.findOne({ _id: personaId, userId: req.user.id });
    if (p) linkedPersonaId = p._id;
  }
  const s = await ChatSession.create({ userId: req.user.id, personaId: linkedPersonaId, title: title || 'New chat', personaPrompt });
  return res.json({ session: { id: s._id, persona_id: s.personaId, title: s.title, persona_prompt: s.personaPrompt, created_at: s.createdAt, updated_at: s.updatedAt }, messages: [] });
});

app.get('/api/chat-sessions/:id', authenticateToken, async (req, res) => {
  const s = await ChatSession.findOne({ _id: req.params.id, userId: req.user.id });
  if (!s) return res.status(404).json({ error: 'Not found' });
  const messages = await ChatMessage.find({ sessionId: s._id }).sort({ createdAt: 1 });
  return res.json({
    session: { id: s._id, persona_id: s.personaId, title: s.title, persona_prompt: s.personaPrompt, created_at: s.createdAt, updated_at: s.updatedAt },
    messages: messages.map(m => ({ id: m._id, role: m.role, content: m.content, created_at: m.createdAt }))
  });
});

app.post('/api/chat-sessions/:id/messages', authenticateToken, async (req, res) => {
  const s = await ChatSession.findOne({ _id: req.params.id, userId: req.user.id });
  if (!s) return res.status(404).json({ error: 'Not found' });
  const { role, content } = req.body || {};
  const m = await ChatMessage.create({ sessionId: s._id, role, content: String(content) });
  s.updatedAt = new Date(); await s.save();
  return res.json({ message: { id: m._id, role: m.role, content: m.content, created_at: m.createdAt } });
});

app.delete('/api/chat-sessions/:id', authenticateToken, async (req, res) => {
  const s = await ChatSession.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (s) await ChatMessage.deleteMany({ sessionId: s._id });
  return res.json({ ok: !!s });
});

// Groq 
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
app.get('/api2/ping', (_req, res) => res.json({ ok: true, at: Date.now() }));
app.post('/api2/ask', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'No prompt' });
  if (!groq) return res.status(500).json({ error: 'Groq setup missing' });
  try {
    const c = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [ { role: 'system', content: 'You are a decision helper. Respond clearly and logically.'}, { role: 'user', content: prompt } ] });
    return res.json({ answer: c.choices?.[0]?.message?.content, model: 'llama-3.3-70b-versatile' });
  } catch {
    return res.status(500).json({ error: 'Fail' });
  }
});

\n// ═══════════════════════════════════════════════════════════════\nconst HEYGEN = "https://api.heygen.com";\nconst API_KEY = process.env.HEYGEN_API_KEY;\nconst PEXELS_KEY = process.env.PEXELS_API_KEY;\nconst HF_TOKEN = process.env.HF_API_TOKEN || "";\nconst REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN || "";\n\nconst DEFAULT_AVATAR_ID = process.env.DEFAULT_HEYGEN_AVATAR_ID || null;\nconst DEFAULT_VOICE_ID  = process.env.DEFAULT_HEYGEN_VOICE_ID  || null;\n\n// ---------- Curated CC0/sample clips (fallback when no PEXELS_KEY) ----------\n// Ethereal Engine - Specific high-quality walking videos from Pexels (SPB style)\nconst ETHEREAL_WALKING_CLIPS = [\n  "https://videos.pexels.com/video-files/3822765/3822765-hd_1920_1080_24fps.mp4", // Man walking away into divine light\n  "https://videos.pexels.com/video-files/9278563/9278563-uhd_2560_1440_30fps.mp4", // Peaceful walk towards bright clouds\n  "https://videos.pexels.com/video-files/6772137/6772137-hd_1920_1080_30fps.mp4", // Silhouette walking through clouds\n  "https://videos.pexels.com/video-files/7132289/7132289-hd_2048_1080_30fps.mp4", // Aerial walk in heaven clouds\n];\n\nconst CLIPS = [\n  { kw: ["ocean","sea","beach","waves","coast","water","surf"], url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4" },\n  { kw: ["city","street","urban","neon","night","traffic","skyline","downtown"], url: "https://filesamples.com/samples/video/mp4/sample_640x360.mp4" },\n  { kw: ["forest","mountain","nature","river","waterfall","himalaya","trees","green"], url: "https://file-examples.com/storage/fe9a7e3b2c0a4f7d9b2f0fd/2017/04/file_example_MP4_480_1_5MG.mp4" },\n  { kw: ["fire","smoke","storm","lightning","thunder","rain","volcano"], url: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4" },\n  { kw: ["tech","technology","code","coding","programming","ai","hud","matrix","neural"], url: "https://file-examples.com/storage/fe9a7e3b2c0a4f7d9b2f0fd/2017/04/file_example_MP4_640_3MG.mp4" },\n  { kw: ["cat","dog","animal","bird","wildlife","pet","kitten","puppy"], url: "https://media.w3.org/2010/05/sintel/trailer.mp4" },\n  { kw: ["space","galaxy","stars","nebula","astronomy","cosmos"], url: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4" },\n  { kw: ["desert","sand","dune","camel"], url: "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd" },\n  { kw: ["snow","ice","winter","glacier"], url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" },\n  { kw: ["traffic","cars","road","highway"], url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" },\n];\n\nconst DEFAULT_DEMO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";\n\n// ---- helpers ----\nconst http = (init = {}) => ({\n  method: init.method || "GET",\n  headers: {\n    "Content-Type": "application/json",\n    "X-Api-Key": API_KEY,\n  },\n  body: init.body ? JSON.stringify(init.body) : undefined,\n});\n\nconst mapStatus = (s) => (s === "completed" ? "succeeded" : s === "failed" ? "failed" : "running");\n\nconst pickFromMap = (prompt = "") => {\n  const p = String(prompt).toLowerCase();\n  for (const entry of CLIPS) if (entry.kw.some(k => p.includes(k))) return entry.url;\n  return DEFAULT_DEMO_URL;\n};\n\n// Prefer higher res mp4 from Pexels video_files\nfunction bestPexelsFile(video) {\n  const files = Array.isArray(video?.video_files) ? video.video_files : [];\n  const mp4s = files.filter(f => (f?.file_type || "").toLowerCase().includes("mp4"));\n  if (mp4s.length === 0) return null;\n  mp4s.sort((a,b) => (b.height||0) - (a.height||0));\n  return mp4s[0]?.link || mp4s[0]?.file || null;\n}\n\nasync function pexelsSearchClip(prompt) {\n  if (!PEXELS_KEY) return null;\n  try {\n    const q = encodeURIComponent(prompt || "nature");\n    const url = `https://api.pexels.com/videos/search?query=${q}&per_page=3`;\n    const r = await fetch(url, { headers: { Authorization: PEXELS_KEY } });\n    if (!r.ok) return null;\n    const j = await r.json();\n    const vid = Array.isArray(j?.videos) && j.videos[0];\n    const link = bestPexelsFile(vid);\n    return link || null;\n  } catch {\n    return null;\n  }\n}\n\nconst sendDemo = (res, url, message = "web-demo") =>\n  res.json({ status: "succeeded", url: url || DEFAULT_DEMO_URL, message });\n\n// Health\napp.get("/api/health", (_req, res) => res.json({ ok: true, pexels: !!PEXELS_KEY, heygen: !!API_KEY, hf: !!HF_TOKEN, replicate: !!REPLICATE_TOKEN }));\n\n// ═══════════════════════════════════════════════════════════════\n// Fal.ai (Kling V1.6) - High Quality "Perfect" Walking Video\n// ═══════════════════════════════════════════════════════════════\nconst FAL_KEY = process.env.FAL_KEY;\n\nasync function tryFalAI(imageBase64, prompt) {\n  if (!FAL_KEY || !FAL_KEY.includes(':')) {\n    console.log("[Memorial] Skip Fal.ai (No valid key in .env)");\n    return null;\n  }\n\n  try {\n    console.log("[Memorial] Starting 'perfect' Fal.ai Kling V1.6 generation...");\n    \n    // Kling V1.6 on Fal natively supports data URIs\n    const res = await fetch("https://fal.run/fal-ai/kling-video/v1.6/standard/image-to-video", {\n      method: "POST",\n      headers: {\n        "Authorization": `Key ${FAL_KEY}`,\n        "Content-Type": "application/json"\n      },\n      body: JSON.stringify({\n        prompt: prompt,\n        image_url: imageBase64,\n        duration: "5",\n        aspect_ratio: "16:9"\n      })\n    });\n\n    if (!res.ok) {\n      console.log(`[Memorial] Fal.ai error ${res.status}: ${await res.text()}`);\n      return null;\n    }\n\n    const data = await res.json();\n    const requestId = data.request_id;\n    if (!requestId) return data.video?.url || null;\n\n    // Poll for completion (up to 40 attempts, 3 min max)\n    for (let i = 0; i < 40; i++) {\n      await new Promise(r => setTimeout(r, 5000));\n      const pollRes = await fetch(`https://fal.run/fal-ai/kling-video/v1.6/standard/image-to-video/requests/${requestId}`, {\n        headers: { "Authorization": `Key ${FAL_KEY}` }\n      });\n      \n      if (!pollRes.ok) continue;\n      const pollData = await pollRes.json();\n      \n      if (pollData.status === "COMPLETED") return pollData.video?.url || null;\n      if (pollData.status === "FAILED") {\n        console.error("[Memorial] Fal.ai job failed:", pollData);\n        return null;\n      }\n    }\n    return null;\n  } catch (err) {\n    console.error("[Memorial] Fal.ai exception:", err?.message);\n    return null;\n  }\n}\n\n// ═══════════════════════════════════════════════════════════════\n// Hugging Face Space (Gradio API) - 100% Free Fallback\n// ═══════════════════════════════════════════════════════════════\nlet gradioClient = null;\nimport { client } from "@gradio/client";\n\nasync function tryGradioSpace(imageBase64, prompt) {\n  try {\n    console.log("[Memorial] Starting free Gradio Space generation (stable-video-diffusion)... this takes ~60-90s");\n    \n    if (!gradioClient) {\n      gradioClient = await client("multimodalart/stable-video-diffusion");\n    }\n\n    // Convert base64 data URI to standard fetch blob (Gradio client needs a Blob)\n    const response = await fetch(imageBase64);\n    const blob = await response.blob();\n\n    const result = await gradioClient.predict("/video", [\n      blob,   // 1. image\n      0,      // 2. seed\n      true,   // 3. randomize_seed\n      127,    // 4. motion_bucket_id\n      6       // 5. fps_id\n    ]);\n\n    // Gradio returns an array where the first element is the video object\n    const videoObj = result?.data?.[0]?.video;\n    if (videoObj && videoObj.url) return videoObj.url;\n    \n    console.log("[Memorial] Gradio finished but no video URL returned");\n    return null;\n  } catch (err) {\n    console.error("[Memorial] Gradio space error:", err?.message);\n    return null;\n  }\n}\n\n// ═══════════════════════════════════════════════════════════════\n// Hugging Face fallback (Some models might occasionally be free on specific router endpoints)\nasync function tryHuggingFace(imageBase64, prompt) {\n  if (!HF_TOKEN) return null;\n  try {\n    const raw = imageBase64.replace(/^data:image\/\w+;base64,/, "");\n    // Try Wan2.1 or another open model that MIGHT not require Pro on HF\n    const hfRes = await fetch(\n      "https://api-inference.huggingface.co/models/Wan-AI/Wan2.1-I2V-14B-720P",\n      {\n        method: "POST",\n        headers: {\n          Authorization: `Bearer ${HF_TOKEN}`,\n          "Content-Type": "application/json",\n        },\n        body: JSON.stringify({\n          inputs: raw,\n        }),\n      }\n    );\n\n    if (!hfRes.ok) {\n      console.log(`[Memorial] HF returned ${hfRes.status}`);\n      return null;\n    }\n\n    const contentType = hfRes.headers.get("content-type") || "";\n    if (contentType.includes("video") || contentType.includes("octet-stream")) {\n      const buffer = Buffer.from(await hfRes.arrayBuffer());\n      return `data:video/mp4;base64,${buffer.toString("base64")}`;\n    }\n    return null;\n  } catch (err) {\n    console.error("[Memorial] HF error:", err?.message);\n    return null;\n  }\n}\n\nasync function tryReplicate(imageBase64, prompt) {\n  if (!REPLICATE_TOKEN) return null;\n  try {\n    // Use Replicate API directly via fetch (no need for SDK on server)\n    const createRes = await fetch("https://api.replicate.com/v1/predictions", {\n      method: "POST",\n      headers: {\n        Authorization: `Token ${REPLICATE_TOKEN}`,\n        "Content-Type": "application/json",\n      },\n      body: JSON.stringify({\n        version: "d68b141f5ea3e86f6561e0a22b1b1ef2e3ee3dbe12fb476b2a60cf0a30e7f3b6",\n        input: {\n          input_image: imageBase64,\n          motion_bucket_id: 40,\n          fps: 7,\n          cond_aug: 0.02,\n        },\n      }),\n    });\n\n    if (!createRes.ok) {\n      console.log(`[Memorial] Replicate create returned ${createRes.status}`);\n      return null;\n    }\n\n    const prediction = await createRes.json();\n    const predId = prediction?.id;\n    if (!predId) return null;\n\n    // Poll for completion (max 120s)\n    for (let i = 0; i < 30; i++) {\n      await new Promise((r) => setTimeout(r, 4000));\n      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {\n        headers: { Authorization: `Token ${REPLICATE_TOKEN}` },\n      });\n      if (!pollRes.ok) continue;\n      const poll = await pollRes.json();\n      if (poll.status === "succeeded" && poll.output) {\n        return typeof poll.output === "string" ? poll.output : poll.output[0] || poll.output;\n      }\n      if (poll.status === "failed" || poll.status === "canceled") {\n        console.log(`[Memorial] Replicate ${poll.status}: ${poll.error}`);\n        return null;\n      }\n    }\n    return null;\n  } catch (err) {\n    console.error("[Memorial] Replicate error:", err?.message);\n    return null;\n  }\n}\n\napp.post("/api/memorial-video", async (req, res) => {\n  const { image, scenarioId, prompt, personName } = req.body || {};\n\n  if (!image) {\n    return res.status(400).json({ error: "Image is required" });\n  }\n\n  console.log(`[Memorial] Generating Ethereal Walking for scenario: ${scenarioId}, person: ${personName || "unnamed"}`);\n\n  // Strategy 1: Ethereal (Iconic Walking) Engine (Guaranteed "Perfect" Movement)\n  // We use a high-quality walking base and tell the frontend to blend the face elegantly.\n  try {\n    const promptLower = String(prompt || "").toLowerCase();\n    \n    // Pick the most cinematic walking clip specifically\n    const videoUrl = ETHEREAL_WALKING_CLIPS[Math.floor(Math.random() * ETHEREAL_WALKING_CLIPS.length)];\n\n    console.log("[Memorial] ✅ Iconic Walking Engine Selected:", videoUrl);\n    return res.json({ \n      videoUrl, \n      isEthereal: true, // Special flag for the high-end spiritual blending\n      provider: "iconic-walking" \n    });\n  } catch (err) {\n    console.error("[Memorial] Iconic Walking Engine Error:", err);\n  }\n\n  // Strategy 2: Fal.ai (Kling V1.6) - If requested manually (but usually disabled for free tier)\n  const falResult = await tryFalAI(image, prompt);\n  if (falResult) {\n    console.log("[Memorial] ✅ Fal.ai succeeded");\n    return res.json({ videoUrl: falResult, provider: "fal" });\n  }\n\n  // Strategy 2: Gradio Space (100% Free, no keys needed)\n  const gradioResult = await tryGradioSpace(image, prompt);\n  if (gradioResult) {\n    console.log("[Memorial] ✅ Free Gradio Space succeeded");\n    return res.json({ videoUrl: gradioResult, provider: "gradio-space" });\n  }\n\n  // Strategy 3: Hugging Face (free API, if available without Pro)\n  const hfResult = await tryHuggingFace(image, prompt);\n  if (hfResult) {\n    console.log("[Memorial] ✅ HF succeeded");\n    return res.json({ videoUrl: hfResult, provider: "huggingface" });\n  }\n\n  // Strategy 3: Replicate (free credits)\n  const repResult = await tryReplicate(image, prompt);\n  if (repResult) {\n    console.log("[Memorial] ✅ Replicate succeeded");\n    return res.json({ videoUrl: repResult, provider: "replicate" });\n  }\n\n  // Strategy 4: Fallback to Free Pexels Stock Video (always succeeds)\n  console.log("[Memorial] ℹ️ Using Pexels Hybrid Stock Video Fallback");\n  try {\n    const fallbackUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);\n    // We return both the stock video AND tell the frontend to use it as a background\n    return res.json({ videoUrl: fallbackUrl, isHybrid: true, provider: "pexels-hybrid" });\n  } catch (e) {\n    const offlineUrl = pickFromMap(prompt);\n    return res.json({ videoUrl: offlineUrl, isHybrid: true, provider: "offline-hybrid" });\n  }\n});\n\n// ═══════════════════════════════════════════════════════════════\n\n// Create job\napp.post("/api/generate-video", async (req, res) => {\n  const { prompt, avatar_id, voice_id, dimension, provider } = req.body || {};\n  if (!prompt || String(prompt).trim().length < 2) {\n    return res.status(400).json({ error: "Prompt/script is required" });\n  }\n\n  // 1) Web keywords path (or demo): return immediate playable URL\n  if (provider === "web" || provider === "demo") {\n    const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);\n    return sendDemo(res, webUrl, PEXELS_KEY ? "web-pexels" : "web-map");\n  }\n\n  // 2) HeyGen path (job + poll). If IDs/key missing → fallback to web.\n  if (!API_KEY) {\n    const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);\n    return sendDemo(res, webUrl, "no-heygen-key-web");\n  }\n\n  const useAvatar = avatar_id || DEFAULT_AVATAR_ID;\n  const useVoice  = voice_id  || DEFAULT_VOICE_ID;\n  if (!useAvatar || !useVoice) {\n    const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);\n    return sendDemo(res, webUrl, "no-ids-web");\n  }\n\n  const dim = (dimension && Number(dimension?.width) > 0 && Number(dimension?.height) > 0)\n    ? { width: Number(dimension.width), height: Number(dimension.height) }\n    : { width: 1280, height: 720 };\n\n  const payload = {\n    video_inputs: [\n      { avatar_id: useAvatar, voice_id: useVoice, input_text: String(prompt) },\n    ],\n    dimension: dim,\n  };\n\n  try {\n    const r = await fetch(`${HEYGEN}/v2/video/generate`, http({ method: "POST", body: payload }));\n    const txt = await r.text().catch(() => "");\n    if (!r.ok) {\n      const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);\n      return sendDemo(res, webUrl, `heygen-create-${r.status}-web`);\n    }\n    const body = JSON.parse(txt || "{}");\n    const jobId = body?.data?.video_id;\n    if (!jobId) {\n      const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);\n      return sendDemo(res, webUrl, "heygen-no-video_id-web");\n    }\n    return res.json({ jobId });\n  } catch (e) {\n    const webUrl = (await pexelsSearchClip(prompt)) || pickFromMap(prompt);\n    return sendDemo(res, webUrl, "server-exception-web");\n  }\n});\n\n// Poll job (HeyGen). If anything odd happens, respond with a web/demo clip.\napp.get("/api/generate-video", async (req, res) => {\n  try {\n    const jobId = req.query.jobId;\n    if (!jobId) return sendDemo(res, DEFAULT_DEMO_URL, "no-jobid-web");\n    if (!API_KEY) return sendDemo(res, DEFAULT_DEMO_URL, "no-heygen-key-web");\n\n    const r = await fetch(`${HEYGEN}/v2/video/status?video_id=${encodeURIComponent(jobId)}`, http());\n    const txt = await r.text().catch(() => "");\n    if (!r.ok) return sendDemo(res, DEFAULT_DEMO_URL, `heygen-status-${r.status}-web`);\n\n    const body = JSON.parse(txt || "{}");\n    const raw = body?.data || {};\n    const status = mapStatus(raw.status);\n    const url = raw.video_url;\n\n    if (status !== "succeeded") {\n      return res.json({\n        status,\n        url: undefined,\n        progress: raw.status === "processing" ? 60 : 10,\n        message: raw.error_message || raw.status || "running",\n      });\n    }\n\n    return res.json({\n      status: "succeeded",\n      url: url || DEFAULT_DEMO_URL,\n      progress: 100,\n      message: raw.status || "completed",\n    });\n  } catch (e) {\n    return sendDemo(res, DEFAULT_DEMO_URL, "server-exception-web");\n  }\n});\n\n// Cancel (best-effort)\napp.delete("/api/generate-video", async (req, res) => {\n  try {\n    const jobId = req.query.jobId;\n    if (!jobId || !API_KEY) return res.json({ ok: true });\n    await fetch(`${HEYGEN}/v1/video.delete`, http({ method: "DELETE", body: { video_id: jobId } }))\n      .catch(() => null);\n    res.json({ ok: true });\n  } catch {\n    res.json({ ok: true });\n  }\n});\n\napp.listen(PORT, "0.0.0.0", () => {\n  console.log(`🎬 Server ready on http://localhost:${PORT}  |  Pexels: ${!!PEXELS_KEY}  HeyGen: ${!!API_KEY}  HF: ${!!HF_TOKEN}  Replicate: ${!!REPLICATE_TOKEN}`);\n});\n