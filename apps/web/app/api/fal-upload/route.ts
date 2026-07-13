import { NextResponse } from "next/server";

// TEMPORARILY disabled: only used to upload images to fal.ai storage ahead
// of a paid model call (face-swap etc.) — not needed for this deploy, and
// its serverless function bundle exceeded Vercel's 250MB uncompressed limit
// (see git history for this file, and next.config.ts's outputFileTracingExcludes
// comment for the underlying cause). Restore the previous commit's version
// once that's addressed.
export async function POST() {
  return NextResponse.json(
    { error: "Image upload for model calls is temporarily unavailable." },
    { status: 501 },
  );
}
