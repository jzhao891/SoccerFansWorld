import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { fal } from "@fal-ai/client";

admin.initializeApp();

export const dispatchFalJob = onDocumentCreated(
  { document: "jobs/{jobId}", timeoutSeconds: 10 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const job = snap.data() as {
      endpoint: string;
      input: Record<string, unknown>;
      status: string;
    };

    // Guard: only process docs created in pending state
    if (job.status !== "pending") return;

    fal.config({ credentials: process.env.FAL_KEY! });

    const webhookUrl =
      `${process.env.WEBHOOK_BASE_URL}/api/fal-webhook` +
      `?secret=${process.env.FAL_WEBHOOK_SECRET}`;

    const { request_id } = await fal.queue.submit(job.endpoint, {
      input: job.input,
      webhookUrl,
    });

    await snap.ref.update({
      falRequestId: request_id,
      status: "queued",
      queuedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);
