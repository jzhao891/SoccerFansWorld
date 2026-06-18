import { NextRequest, NextResponse } from "next/server";
import type { RenderTier } from "@sfw/shared";
import { renderCard } from "@/lib/card/render";
import type { CardRenderRequest } from "@/lib/card/types";

export const runtime = "nodejs"; // sharp needs the Node runtime

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CardRenderRequest>;
    const { playerImage, name, team, city, overall, card, tier } = body;

    if (!playerImage || !card) {
      return NextResponse.json({ error: "Missing playerImage or card data" }, { status: 400 });
    }

    const png = await renderCard({
      playerImage,
      name: name ?? "",
      team: team ?? "",
      city: city ?? "",
      overall: overall ?? 0,
      card,
      tier: (tier as RenderTier) ?? "free",
    });

    const imageUrl = `data:image/png;base64,${png.toString("base64")}`;
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Card render error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
