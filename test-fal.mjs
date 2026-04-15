import 'dotenv/config';

const FAL_KEY = process.env.FAL_KEY || process.env.HF_API_TOKEN;

async function testFal() {
  console.log("Token starts with:", FAL_KEY ? FAL_KEY.substring(0, 5) : "NULL");
  
  // 1x1 base64 transparent PNG
  const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const imageBytes = Buffer.from(imageBase64, 'base64');

  try {
    // 1. Upload to fal storage
    console.log("Uploading to fal storage...");
    
    // We can use a free 3rd party host or try fal's CDN if it has a REST API, 
    // but the easiest way to upload to fal via REST without their SDK is POSTing to their storage URL
    // Actually, Luma ray-2 usually accepts data URIs if formatted exactly, or we can use another model like Kling.
    // Let's try Kling V1.6 which definitely accepts data URIs.
    
    const res = await fetch("https://fal.run/fal-ai/kling-video/v1.6/standard/image-to-video", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: "person walking",
        image_url: `data:image/png;base64,${imageBase64}`
      })
    });

    console.log("Kling Status:", res.status);
    
    if (!res.ok) {
      console.log("Kling Error:", await res.text());
    } else {
      const data = await res.json();
      console.log("Kling Success! Video URL:", data.video?.url, data);
    }
  } catch (e) {
    console.error("Fetch Exception:", e);
  }
}

testFal();
