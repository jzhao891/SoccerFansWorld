import { NextRequest, NextResponse } from "next/server";
import { swapFace } from "@/lib/faceSwapProviders";

export async function POST(req: NextRequest) {
  try {
    const { faceImageData, playerId } = await req.json();

    if (!faceImageData || !playerId) {
      return NextResponse.json({ error: "Missing faceImageData or playerId" }, { status: 400 });
    }

    const imageUrl = await swapFace(faceImageData, playerId);
    const provider = process.env.FACE_SWAP_PROVIDER ?? "huggingface";

    return NextResponse.json({ imageUrl, provider });
  } catch (error) {
    console.error("Face swap error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
