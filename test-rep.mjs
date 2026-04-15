import 'dotenv/config';

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

async function testReplicate() {
  console.log("Token starts with:", REPLICATE_TOKEN ? REPLICATE_TOKEN.substring(0, 5) : "NULL");
  
  const imageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  
  try {
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

    console.log("Create Status:", createRes.status);
    
    if (!createRes.ok) {
        console.log("Error:", await createRes.text());
        return;
    }
    
    const prediction = await createRes.json();
    console.log("Prediction ID:", prediction.id);
    
  } catch(e) {
    console.error("Error:", e);
  }
}

testReplicate();
