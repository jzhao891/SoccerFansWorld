import { NextRequest, NextResponse } from "next/server";
import { swapFace } from "@/lib/faceSwapProviders";

export async function POST(req: NextRequest) {
  try {
    const { faceImageData, teamId, poseId } = await req.json();

    if (!faceImageData || !teamId || !poseId) {
      return NextResponse.json({ error: "Missing faceImageData, teamId, or poseId" }, { status: 400 });
    }

    const imageUrl = await swapFace(faceImageData, teamId, poseId);
    const provider = process.env.FACE_SWAP_PROVIDER ?? "huggingface";

    return NextResponse.json({ imageUrl, provider });
  } catch (error) {
    console.error("Face swap error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
