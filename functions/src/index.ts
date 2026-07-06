import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { fal } from "@fal-ai/client";
import { Client } from "@gradio/client";

admin.initializeApp();

type JobProvider = "fal" | "huggingface";

interface JobData {
  provider?: JobProvider; // absent on older docs — defaults to "fal" for back-compat
  endpoint: string;
  input: Record<string, unknown>;
  status: string;
}

export const dispatchFalJob = onDocumentCreated(
  { document: "jobs/{jobId}", timeoutSeconds: 120 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const job = snap.data() as JobData;

    // Guard: only process docs created in pending state
    if (job.status !== "pending") return;

    const provider = job.provider ?? "fal";

    try {
      if (provider === "huggingface") {
        await dispatchHuggingFaceJob(job, snap.ref);
      } else {
        await dispatchFalQueueJob(job, snap.ref);
      }
    } catch (err) {
      console.error("dispatchFalJob failed:", err);
      await snap.ref.update({
        status: "error",
        error: serializeError(err),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

// ─── fal — paid, async queue + webhook ────────────────────────────────────────

async function dispatchFalQueueJob(job: JobData, ref: FirebaseFirestore.DocumentReference) {
  fal.config({ credentials: process.env.FAL_KEY! });

  const webhookUrl =
    `${process.env.WEBHOOK_BASE_URL}/api/fal-webhook` +
    `?secret=${process.env.FAL_WEBHOOK_SECRET}`;

  const { request_id } = await fal.queue.submit(job.endpoint, {
    input: job.input,
    webhookUrl,
  });

  await ref.update({
    falRequestId: request_id,
    status: "queued",
    queuedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── HuggingFace — free, resolved synchronously (no queue, no webhook) ───────

async function dispatchHuggingFaceJob(job: JobData, ref: FirebaseFirestore.DocumentReference) {
  const { srcImageUrl, destImageUrl } = job.input as { srcImageUrl: string; destImageUrl: string };

  const [srcBlob, destBlob] = await Promise.all([
    fetch(srcImageUrl).then((r) => r.blob()),
    fetch(destImageUrl).then((r) => r.blob()),
  ]);

  const connectOptions = process.env.HF_TOKEN
    ? { token: process.env.HF_TOKEN as `hf_${string}` }
    : {};
  const client = await Client.connect("tonyassi/face-swap", connectOptions);

  const result = await client.predict("/swap_faces", {
    src_img: srcBlob,
    dest_img: destBlob,
  });

  const output = (result.data as unknown[])[0];
  const outputUrl =
    typeof output === "string"
      ? output
      : (output as { url?: string } | undefined)?.url;

  if (!outputUrl) throw new Error("No output from HuggingFace face swap");

  await ref.update({
    status: "done",
    outputUrl,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── Error serialization ──────────────────────────────────────────────────────

// Some libraries (e.g. @gradio/client) reject with plain objects/Response-like values
// rather than Error instances, which String()/toString() renders as "[object Object]".
function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
