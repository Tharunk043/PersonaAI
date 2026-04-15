import { client } from "@gradio/client";

const SPACES = [
  "multimodalart/stable-video-diffusion",
  "vdo/stable-video-diffusion",
  "THUDM/CogVideoX-5b-I2V",
  "Lightricks/LTX-Video",
  "Wan-AI/Wan2.1-I2V-480P",
  "camenduru/AnimateDiff-Lightning"
];

async function checkSpaces() {
  for (const space of SPACES) {
    console.log(`Checking ${space}...`);
    try {
      const app = await client(space);
      console.log(`✅ ${space} is ONLINE`);
    } catch (e) {
      console.log(`❌ ${space} is OFFLINE or RESTRICTED: ${e.message}`);
    }
  }
}

checkSpaces();
