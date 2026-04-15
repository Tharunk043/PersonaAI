import { client } from "@gradio/client";
import fs from "fs";

async function testLTX() {
  console.log("Connecting to Lightricks/LTX-2...");
  try {
    const app = await client("Lightricks/LTX-2");
    console.log("Connected. Sending image...");
    
    // Use a public image URL for testing
    const imageUrl = "https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png";
    const res = await fetch(imageUrl);
    const blob = await res.blob();

    const result = await app.predict("/generate_video", [
      blob,       // Input Image
      "",         // Negative Prompt
      "walking",  // Prompt
      0,          // Seed
      true,       // Randomize Seed
      32,         // Guidance Scale
      10,         // Inference Steps
      768,        // Width
      512,        // Height
      2,          // Video Duration
      true        // Upscale
    ]);

    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("LTX Error:", e.message);
  }
}

testLTX();
