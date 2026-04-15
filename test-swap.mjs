import { client } from "@gradio/client";

async function testFaceSwap() {
  console.log("Connecting to tonyassi/Video-Face-Swap...");
  try {
    const app = await client("tonyassi/Video-Face-Swap");
    console.log("Connected. Sending data...");

    const imageUrl = "https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png";
    const videoUrl = "https://videos.pexels.com/video-files/6772137/6772137-hd_1920_1080_30fps.mp4";
    
    const imgRes = await fetch(imageUrl);
    const imgBlob = await imgRes.blob();
    
    const vidRes = await fetch(videoUrl);
    const vidBlob = await vidRes.blob();

    const result = await app.predict("/generate_1", [
      imgBlob,  // Source Image
      vidBlob,  // Input Video
      "all"     // Gender
    ]);

    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Face Swap Error:", e.message);
  }
}

testFaceSwap();
