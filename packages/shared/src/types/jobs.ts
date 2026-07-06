export type JobStatus = "pending" | "queued" | "done" | "error";
export type JobType = "image" | "video";
/** Which backend actually runs the model. fal is paid/queued+webhook; huggingface is free and
 *  resolved synchronously inside the Cloud Function (no queue, no webhook). */
export type JobProvider = "fal" | "huggingface";

/** Shape written to Firestore `jobs/{jobId}` by the caller before creation. */
export interface JobInput {
  provider: JobProvider;
  /** fal endpoint ID (provider "fal"), e.g. "easel-ai/advanced-face-swap" —
   *  for provider "huggingface" this is just a descriptive label (e.g. the HF Space id). */
  endpoint: string;
  /**
   * Provider-specific payload — all assets must already be public URLs (pre-upload via
   * fal.storage.upload, used purely as free file hosting regardless of provider).
   *   fal:          the exact fal input object (e.g. face_image_0, target_image, ...)
   *   huggingface:  { srcImageUrl: string, destImageUrl: string }
   */
  input: Record<string, unknown>;
  /** Drives UX expectations only; does not affect processing */
  jobType: JobType;
  /** Where to send the "your result is ready" email */
  userEmail: string;
  /** Firebase Auth uid (anonymous or real) that owns this job — enforced by Firestore rules */
  ownerUid: string;
  status: "pending";
  createdAt: unknown; // serverTimestamp()
}

/** Full shape of the doc after all pipeline stages complete. */
export interface JobDoc extends Omit<JobInput, "status"> {
  status: JobStatus;
  falRequestId?: string;
  queuedAt?: unknown;
  outputUrl?: string;
  error?: string;
  completedAt?: unknown;
}
