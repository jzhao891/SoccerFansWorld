// Run once to generate player template images via fal.ai FLUX
// Usage: FAL_KEY=... node scripts/generate-players.mjs

import { fal } from "@fal-ai/client";
import { writeFileSync } from "fs";
import { join } from "path";

fal.config({ credentials: process.env.FAL_KEY });

const players = [
  {
    name: "striker",
    prompt: "professional soccer player portrait, green jersey number 10, looking at camera, studio lighting, photorealistic, upper body shot, white background",
  },
  {
    name: "midfielder",
    prompt: "professional soccer player portrait, blue jersey number 8, looking at camera, studio lighting, photorealistic, upper body shot, white background",
  },
  {
    name: "defender",
    prompt: "professional soccer player portrait, red jersey number 5, looking at camera, studio lighting, photorealistic, upper body shot, white background",
  },
];

for (const player of players) {
  console.log(`Generating ${player.name}...`);
  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt: player.prompt,
      image_size: "portrait_4_3",
      num_inference_steps: 4,
      num_images: 1,
    },
  });

  const imageUrl = result.data.images[0].url;
  const res = await fetch(imageUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = join(process.cwd(), "public", "players", `${player.name}.jpg`);
  writeFileSync(outPath, buffer);
  console.log(`Saved ${player.name}.jpg`);
}

console.log("Done!");
