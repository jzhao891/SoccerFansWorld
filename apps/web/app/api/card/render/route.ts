import { NextResponse } from "next/server";

// TEMPORARILY disabled: the real implementation (see `git log` for this
// file) imports renderCard from @/lib/card/render, which pulls in `sharp`
// and traces to a 339MB serverless function bundle on Vercel — over the
// platform's 250MB uncompressed limit. Unrelated to the frame studio feature
// this route was disabled to unblock. Restore the previous commit's version
// once the traced dependency graph is fixed (or the project opts into
// Vercel's large-functions beta).
export async function POST() {
  return NextResponse.json(
    { error: "Card rendering is temporarily unavailable." },
    { status: 501 },
  );
}
