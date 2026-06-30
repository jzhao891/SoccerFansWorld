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
admin.initializeApp();
exports.dispatchFalJob = (0, firestore_1.onDocumentCreated)({ document: "jobs/{jobId}", timeoutSeconds: 10 }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const job = snap.data();
    // Guard: only process docs created in pending state
    if (job.status !== "pending")
        return;
    client_1.fal.config({ credentials: process.env.FAL_KEY });
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/fal-webhook` +
        `?secret=${process.env.FAL_WEBHOOK_SECRET}`;
    const { request_id } = await client_1.fal.queue.submit(job.endpoint, {
        input: job.input,
        webhookUrl,
    });
    await snap.ref.update({
        falRequestId: request_id,
        status: "queued",
        queuedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
});
//# sourceMappingURL=index.js.map