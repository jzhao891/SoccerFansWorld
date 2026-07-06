import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { fal } from "@fal-ai/client";
import { getAdminDb } from "@/lib/firebaseAdmin";
import type { JobDoc } from "@sfw/shared";

export const runtime = "nodejs";

// ─── fal result → output URL ─────────────────────────────────────────────────

function extractOutputUrl(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const d = data as Record<string, unknown>;

  // video.url  — Seedance, Kling i2v/t2v, Wan, Pixverse
  const video = d.video as Record<string, unknown> | undefined;
  if (typeof video?.url === "string") return video.url;

  // image.url  — easel-ai/advanced-face-swap
  const image = d.image as Record<string, unknown> | undefined;
  if (typeof image?.url === "string") return image.url;

  // images[0].url  — nano-banana-2/edit
  const images = d.images;
  if (Array.isArray(images) && typeof (images[0] as Record<string, unknown>)?.url === "string") {
    return (images[0] as Record<string, unknown>).url as string;
  }

  // top-level url string  — fallback
  if (typeof d.url === "string") return d.url;

  return undefined;
}

// ─── email via Resend ─────────────────────────────────────────────────────────

async function sendResultEmail(to: string, outputUrl: string, jobType: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // email is optional; skip if not configured

  const label = jobType === "video" ? "video" : "image";
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "FandarAI <noreply@fandar.ai>",
      to,
      subject: `Your ${label} is ready!`,
      html: `<p>Your ${label} has finished generating.</p><p><a href="${outputUrl}">View / download it here</a></p>`,
    }),
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Verify the shared secret passed as a query param when the Cloud Function
  // registered the webhook URL.
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.FAL_WEBHOOK_SECRET || secret !== process.env.FAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { request_id?: string; status?: string; error?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { request_id, status: falStatus } = body;
  if (!request_id) {
    return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
  }

  const db = getAdminDb();

  // Look up the job by falRequestId
  const snapshot = await db
    .collection("jobs")
    .where("falRequestId", "==", request_id)
    .limit(1)
    .get();

  if (snapshot.empty) {
    // Log and return 200 so fal doesn't retry indefinitely
    console.error(`fal-webhook: no job found for request_id=${request_id}`);
    return NextResponse.json({ ok: true });
  }

  const jobDoc = snapshot.docs[0];
  const job = jobDoc.data() as JobDoc;

  // Handle fal-reported errors
  if (falStatus === "ERROR" || falStatus === "FAILED") {
    await jobDoc.ref.update({
      status: "error",
      error: JSON.stringify(body.error ?? "fal reported an error"),
      completedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  }

  // Fetch the full result from fal (more reliable than parsing the webhook payload)
  fal.config({ credentials: process.env.FAL_KEY! });
  let resultData: unknown;
  try {
    const result = await fal.queue.result(job.endpoint, { requestId: request_id });
    resultData = result.data;
  } catch (err) {
    await jobDoc.ref.update({
      status: "error",
      error: String(err),
      completedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  }

  const outputUrl = extractOutputUrl(resultData);
  if (!outputUrl) {
    console.error(`fal-webhook: could not extract outputUrl from`, JSON.stringify(resultData).slice(0, 400));
    await jobDoc.ref.update({
      status: "error",
      error: "Could not extract output URL from fal result",
      completedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  }

  await jobDoc.ref.update({
    status: "done",
    outputUrl,
    completedAt: FieldValue.serverTimestamp(),
  });

  if (job.userEmail) {
    await sendResultEmail(job.userEmail, outputUrl, job.jobType);
  }

  return NextResponse.json({ ok: true });
}
