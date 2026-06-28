import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { fal } from "@fal-ai/client";

admin.initializeApp();

const FAL_KEY = defineString("FAL_KEY");
const WEBHOOK_BASE_URL = defineString("WEBHOOK_BASE_URL");  // e.g. https://fandar.ai
const FAL_WEBHOOK_SECRET = defineString("FAL_WEBHOOK_SECRET");

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

    fal.config({ credentials: FAL_KEY.value() });

    const webhookUrl =
      `${WEBHOOK_BASE_URL.value()}/api/fal-webhook` +
      `?secret=${FAL_WEBHOOK_SECRET.value()}`;

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
