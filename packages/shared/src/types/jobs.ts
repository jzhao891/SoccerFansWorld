export type JobStatus = "pending" | "queued" | "done" | "error";
export type JobType = "image" | "video";

/** Shape written to Firestore `jobs/{jobId}` by the caller before creation. */
export interface JobInput {
  /** fal endpoint ID, e.g. "fal-ai/bytedance/seedance/v1/pro/image-to-video" */
  endpoint: string;
  /** fal input payload — all assets must already be public URLs (pre-upload via fal.storage.upload) */
  input: Record<string, unknown>;
  /** Drives UX expectations only; does not affect processing */
  jobType: JobType;
  /** Where to send the "your result is ready" email */
  userEmail: string;
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
