import fs from 'fs';

const oldContent = fs.readFileSync('server/server.mjs', 'utf8');
const lines = oldContent.split('\n');

const newContent = `import mongoose from 'mongoose';
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

`;

const mergedContent = lines.slice(0,4).join('\\n') + '\\n' + newContent + '\\n' + lines.slice(329).join('\\n');
fs.writeFileSync('server/server.mjs', mergedContent);
console.log('Done!');
