import { readFileSync } from "fs";
import { join } from "path";
import { applyAlphaFromTemplate } from "./cutout";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function base64ToBlob(base64: string, mimeType = "image/jpeg"): Blob {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(data, "base64");
  return new Blob([buffer], { type: mimeType });
}

function playerFileToBlob(teamId: string, poseId: string): Blob {
  // Template path: /public/players/{teamId}/{poseId}.png
  const filePath = join(process.cwd(), "public", "players", teamId, `${poseId}.png`);
  const buffer = readFileSync(filePath);
  return new Blob([buffer], { type: "image/png" });
}

// ─── HuggingFace (free) ────────────────────────────────────────────────────────

async function swapWithHuggingFace(
  faceImageData: string,
  teamId: string,
  poseId: string
): Promise<string> {
  const { Client } = await import("@gradio/client");

  const connectOptions = process.env.HF_TOKEN
    ? { token: process.env.HF_TOKEN as `hf_${string}` }
    : {};
  const client = await Client.connect("tonyassi/face-swap", connectOptions);

  const srcBlob = base64ToBlob(faceImageData);          // user face → source
  const destBlob = playerFileToBlob(teamId, poseId);    // team+pose template → target

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
  teamId: string,
  poseId: string
): Promise<string> {
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY });

  // Upload user face to fal storage (needs a public URL)
  const srcBlob = base64ToBlob(faceImageData);
  const srcFile = new File([srcBlob], "face.jpg", { type: "image/jpeg" });
  const uploadedFaceUrl = await fal.storage.upload(srcFile);

  // Upload player template to fal storage too
  const destBlob = playerFileToBlob(teamId, poseId);
  const destFile = new File([destBlob], "player.png", { type: "image/png" });
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
  teamId: string,
  poseId: string
): Promise<string> {
  const provider = process.env.FACE_SWAP_PROVIDER ?? "huggingface";

  const resultUrl =
    provider === "fal"
      ? await swapWithFal(faceImageData, teamId, poseId)
      : await swapWithHuggingFace(faceImageData, teamId, poseId);

  // The face-swap model flattens transparency (returns a grey background).
  // Reapply the original template's alpha silhouette so the edges stay exactly
  // as clean as the transparent template the user provided.
  try {
    const res = await fetch(resultUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const templatePath = join(process.cwd(), "public", "players", teamId, `${poseId}.png`);
    const composited = await applyAlphaFromTemplate(buffer, templatePath);
    return `data:image/png;base64,${composited.toString("base64")}`;
  } catch {
    // If compositing fails, fall back to the raw model output
    return resultUrl;
  }
}
