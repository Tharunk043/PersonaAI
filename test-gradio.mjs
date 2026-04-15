import { client } from "@gradio/client";

async function testGradioVideo() {
  console.log("Connecting to Gradio Space...");
  try {
    const app = await client("multimodalart/stable-video-diffusion");
    
    // Using an arbitrary Pexels static image URL to test
    const response = await fetch("https://images.pexels.com/photos/45201/kitty-cat-kitten-pet-45201.jpeg?auto=compress&cs=tinysrgb&w=300");
    const blob = await response.blob();
    
    console.log("Submitting video job...");
    const result = await app.predict("/video", [
      blob,   // image
      0,      // seed
      true,   // randomize_seed
      127,    // motion_bucket_id
      6       // fps_id
    ]);
    
    console.log("Gradio Result:", JSON.stringify(result, null, 2));
  } catch(e) {
    console.error("Gradio Client Error:", e);
  }
}

testGradioVideo();
