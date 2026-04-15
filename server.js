import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// CURRENT WORKING MODELS (Feb 2025)
const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "llama-3.3-8b-instant";

app.get("/api2/ping", (_req, res) => res.json({ ok: true, at: Date.now() }));

app.post("/api2/ask", async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "No prompt provided" });
  }

  try {
    const answer = await askGroq(prompt, PRIMARY_MODEL);
    return res.json({ answer, model: PRIMARY_MODEL });
  } catch (err) {
    // If primary fails, try fallback model
    const answer = await askGroq(prompt, FALLBACK_MODEL);
    return res.json({ answer, model: FALLBACK_MODEL, note: "fallback model used" });
  }
});

async function askGroq(prompt, model) {
  const chat = await groq.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "You are a decision helper. Respond clearly and logically." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
  });

  return chat.choices?.[0]?.message?.content || "No answer generated";
}

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`🧠 Using Groq Models: primary=${PRIMARY_MODEL}, fallback=${FALLBACK_MODEL}`);
});
