import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

/**
 * Upload an image to fal storage and return the public URL.
 *
 * Accepts one of:
 *   { base64: string, name: string, mimeType: string }  — user-uploaded image
 *   { publicPath: string }                              — file under /public served by this app
 */
export async function POST(req: NextRequest) {
  fal.config({ credentials: process.env.FAL_KEY! });

  const body = await req.json() as {
    base64?: string;
    name?: string;
    mimeType?: string;
    publicPath?: string;
  };

  let file: File;

  if (body.publicPath) {
    // Serve a file from the Next.js public/ directory (not accessible to fal during local dev)
    const safePath = body.publicPath.replace(/\.\./g, ""); // prevent path traversal
    const abs = join(process.cwd(), "public", safePath);
    const buf = readFileSync(abs);
    const ext = safePath.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    file = new File([buf], safePath.split("/").pop() ?? "file.png", { type: mime });
  } else if (body.base64) {
    const data = body.base64.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(data, "base64");
    const mime = (body.mimeType ?? "image/jpeg") as string;
    const name = body.name ?? "upload.jpg";
    file = new File([buf], name, { type: mime });
  } else {
    return NextResponse.json({ error: "Provide base64 or publicPath" }, { status: 400 });
  }

  const url = await fal.storage.upload(file);
  return NextResponse.json({ url });
}
