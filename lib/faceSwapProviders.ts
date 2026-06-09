import { readFileSync } from "fs";
import { join } from "path";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function base64ToBlob(base64: string, mimeType = "image/jpeg"): Blob {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(data, "base64");
  return new Blob([buffer], { type: mimeType });
}

function playerFileToBlob(playerId: string): Blob {
  // Try PNG first (new templates), fall back to JPG
  const pngPath = join(process.cwd(), "public", "players", `${playerId}.png`);
  const jpgPath = join(process.cwd(), "public", "players", `${playerId}.jpg`);
  try {
    const buffer = readFileSync(pngPath);
    return new Blob([buffer], { type: "image/png" });
  } catch {
    const buffer = readFileSync(jpgPath);
    return new Blob([buffer], { type: "image/jpeg" });
  }
}

// ─── HuggingFace (free) ────────────────────────────────────────────────────────

async function swapWithHuggingFace(
  faceImageData: string,
  playerId: string
): Promise<string> {
  const { Client } = await import("@gradio/client");

  const connectOptions = process.env.HF_TOKEN
    ? { token: process.env.HF_TOKEN as `hf_${string}` }
    : {};
  const client = await Client.connect("tonyassi/face-swap", connectOptions);

  const srcBlob = base64ToBlob(faceImageData);     // user face → source
  const destBlob = playerFileToBlob(playerId);      // player template → target

  const result = await client.predict("/swap_faces", {
    src_img: srcBlob,
    dest_img: destBlob,
  });

  // Gradio returns the output image as { url: string } or a raw URL string
  const output = (result.data as unknown[])[0];
  if (!output) throw new Error("No output from HuggingFace face swap");

  if (typeof output === "string") return output;
  if (typeof output === "object" && output !== null && "url" in output) {
    return (output as { url: string }).url;
  }
  throw new Error(`Unexpected HuggingFace response: ${JSON.stringify(output)}`);
}

// ─── fal.ai (paid, higher quality) ────────────────────────────────────────────

async function swapWithFal(
  faceImageData: string,
  playerId: string
): Promise<string> {
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY });

  // Upload user face to fal storage (needs a public URL)
  const srcBlob = base64ToBlob(faceImageData);
  const srcFile = new File([srcBlob], "face.jpg", { type: "image/jpeg" });
  const uploadedFaceUrl = await fal.storage.upload(srcFile);

  // Upload player template to fal storage too
  const destBlob = playerFileToBlob(playerId);
  const destFile = new File([destBlob], "player.jpg", { type: "image/jpeg" });
  const uploadedPlayerUrl = await fal.storage.upload(destFile);

  const result = await fal.subscribe("easel-ai/advanced-face-swap", {
    input: {
      face_image_0: uploadedFaceUrl,
      target_image: uploadedPlayerUrl,
      gender_0: "male",
      workflow_type: "target_hair",
      upscale: true,
    },
  });

  const data = result.data as { image: { url: string } };
  return data.image.url;
}

// ─── Public entry point ────────────────────────────────────────────────────────

export async function swapFace(
  faceImageData: string,
  playerId: string
): Promise<string> {
  const provider = process.env.FACE_SWAP_PROVIDER ?? "huggingface";

  if (provider === "fal") {
    return swapWithFal(faceImageData, playerId);
  }
  return swapWithHuggingFace(faceImageData, playerId);
}
