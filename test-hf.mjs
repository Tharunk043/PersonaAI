import 'dotenv/config';

const HF_TOKEN = process.env.HF_API_TOKEN;

async function testHF() {
  console.log("Token starts with:", HF_TOKEN ? HF_TOKEN.substring(0, 5) : "NULL");
  
  const raw = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  
  try {
    const hfRes = await fetch(
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-video-diffusion-img2vid-xt",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: raw,
          parameters: { num_frames: 25, fps: 7 },
        }),
      }
    );

    console.log("Status:", hfRes.status);
    console.log("Headers:", Object.fromEntries(hfRes.headers.entries()));
    
    const contentType = hfRes.headers.get("content-type") || "";
    if (contentType.includes("video") || contentType.includes("octet-stream")) {
        console.log("SUCCESS! Got video blob.");
    } else {
        const text = await hfRes.text();
        console.log("Response text:", text);
    }
  } catch(e) {
    console.error("Error:", e);
  }
}

testHF();
