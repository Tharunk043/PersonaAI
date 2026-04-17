import mongoose from 'mongoose';

// 1. User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);

// 2. Persona Schema
const personaSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  prompt: { type: String, required: true },
  description: { type: String, default: '' },
  isPublic: { type: Boolean, default: true },
}, { timestamps: true });

export const Persona = mongoose.model('Persona', personaSchema);

// 3. Chat Session Schema
const chatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  personaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Persona', default: null },
  title: { type: String, required: true },
  personaPrompt: { type: String, required: true },
  type: { type: String, enum: ['chat', 'debate'], default: 'chat' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Create an index for retrieving user sessions sorted by updated_at
chatSessionSchema.index({ userId: 1, type: 1, updatedAt: -1 });

export const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

// 4. Chat Message Schema
const chatMessageSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true },
  role: { type: String, required: true, enum: ['user', 'assistant', 'system'] },
  content: { type: String, required: true },
}, { timestamps: true });

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
