"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchFalJob = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const client_1 = require("@fal-ai/client");
const client_2 = require("@gradio/client");
admin.initializeApp();
exports.dispatchFalJob = (0, firestore_1.onDocumentCreated)({ document: "jobs/{jobId}", timeoutSeconds: 120 }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const job = snap.data();
    // Guard: only process docs created in pending state
    if (job.status !== "pending")
        return;
    const provider = job.provider ?? "fal";
    try {
        if (provider === "huggingface") {
            await dispatchHuggingFaceJob(job, snap.ref);
        }
        else {
            await dispatchFalQueueJob(job, snap.ref);
        }
    }
    catch (err) {
        console.error("dispatchFalJob failed:", err);
        await snap.ref.update({
            status: "error",
            error: serializeError(err),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
// ─── fal — paid, async queue + webhook ────────────────────────────────────────
async function dispatchFalQueueJob(job, ref) {
    client_1.fal.config({ credentials: process.env.FAL_KEY });
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/fal-webhook` +
        `?secret=${process.env.FAL_WEBHOOK_SECRET}`;
    const { request_id } = await client_1.fal.queue.submit(job.endpoint, {
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
async function dispatchHuggingFaceJob(job, ref) {
    const { srcImageUrl, destImageUrl } = job.input;
    const [srcBlob, destBlob] = await Promise.all([
        fetch(srcImageUrl).then((r) => r.blob()),
        fetch(destImageUrl).then((r) => r.blob()),
    ]);
    const connectOptions = process.env.HF_TOKEN
        ? { token: process.env.HF_TOKEN }
        : {};
    const client = await client_2.Client.connect("tonyassi/face-swap", connectOptions);
    const result = await client.predict("/swap_faces", {
        src_img: srcBlob,
        dest_img: destBlob,
    });
    const output = result.data[0];
    const outputUrl = typeof output === "string"
        ? output
        : output?.url;
    if (!outputUrl)
        throw new Error("No output from HuggingFace face swap");
    await ref.update({
        status: "done",
        outputUrl,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
// ─── Error serialization ──────────────────────────────────────────────────────
// Some libraries (e.g. @gradio/client) reject with plain objects/Response-like values
// rather than Error instances, which String()/toString() renders as "[object Object]".
function serializeError(err) {
    if (err instanceof Error)
        return err.message;
    try {
        return JSON.stringify(err);
    }
    catch {
        return String(err);
    }
}
//# sourceMappingURL=index.js.map