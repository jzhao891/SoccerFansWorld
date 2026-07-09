import { NextRequest, NextResponse } from "next/server";
import type { FrameRenderRequest, RenderTier } from "@sfw/shared";
import { renderFrame } from "@/lib/frames/render";

export const runtime = "nodejs"; // sharp needs the Node runtime

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<FrameRenderRequest>;
    const { templateId, photoDataUrl, selection, inputs, tier } = body;

    if (!templateId || !photoDataUrl) {
      return NextResponse.json(
        { error: "Missing templateId or photoDataUrl" },
        { status: 400 },
      );
    }

    const png = await renderFrame({
      templateId,
      photoDataUrl,
      selection: selection ?? {},
      inputs: inputs ?? {},
      tier: (tier as RenderTier) ?? "free",
    });

    const imageUrl = `data:image/png;base64,${png.toString("base64")}`;
    return NextResponse.json({ imageUrl });
  } catch (error) {
    // Full error stays server-side only — the client shows a generic
    // message rather than surfacing internals (stack traces, sharp/file
    // errors, etc.) to the customer.
    console.error("Frame render error:", error);
    return NextResponse.json({ error: "Render failed" }, { status: 500 });
  }
}
