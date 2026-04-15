import { client } from "@gradio/client";

async function testCogVideo() {
  console.log("Connecting to CogVideoX-5b-I2V...");
  try {
    const app = await client("THUDM/CogVideoX-5b-I2V");
    const info = await app.view_api();
    console.log(JSON.stringify(info, null, 2));
  } catch(e) {
    console.error("Gradio Client Error:", e);
  }
}

testCogVideo();
