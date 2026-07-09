"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FrameTemplate } from "@sfw/shared";

export default function FrameStudioClient({ frames }: { frames: FrameTemplate[] }) {
  const dailyFrames = useMemo(() => frames.filter((f) => f.id.startsWith("daily-")), [frames]);
  const otherFrames = useMemo(() => frames.filter((f) => !f.id.startsWith("daily-")), [frames]);

  const [frame, setFrame] = useState<FrameTemplate>(frames[0]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // WeChat's built-in browser (and similar in-app webviews) blocks both the
  // Web Share API and the blob-URL/<a download> fallback — a download
  // attempt there either silently fails or the OS shows its own "open in
  // browser" prompt with no useful instructions. Detected client-side only
  // (navigator isn't available during SSR) so this starts false and flips
  // true after mount if applicable — never a false positive, worst case is a
  // one-frame delay before the banner appears.
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  useEffect(() => {
    setIsInAppBrowser(/MicroMessenger/i.test(navigator.userAgent));
  }, []);

  // The camera preview needs to know exactly where the photo will land and
  // which static border art sits on top of it — reuse the same layer specs
  // the server-side compositor uses, so the live preview matches the final
  // render pixel-for-pixel instead of drifting out of sync with it.
  const photoLayer = useMemo(
    () => frame.layers.find((l): l is Extract<typeof frame.layers[number], { type: "photo" }> => l.type === "photo"),
    [frame],
  );
  const overlayLayers = useMemo(
    () => frame.layers.filter((l): l is Extract<typeof frame.layers[number], { type: "overlay" }> => l.type === "overlay"),
    [frame],
  );

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Backgrounding the tab (switching apps, locking the phone) without
  // releasing the camera is another way to wedge it at the OS level until a
  // full reload — mobile Safari in particular doesn't reliably fire our own
  // unmount cleanup in that case, so listen for the tab going hidden too.
  useEffect(() => {
    function releaseOnHide() {
      if (document.visibilityState === "hidden") stopCamera();
    }
    document.addEventListener("visibilitychange", releaseOnHide);
    return () => document.removeEventListener("visibilitychange", releaseOnHide);
  }, []);

  async function startCamera() {
    setCameraError("");
    // Release any stream we're still holding before asking for a new one —
    // requesting a second concurrent camera stream without stopping the
    // first is exactly what wedges the camera on iOS Safari until a full
    // page reload (the "works once, then stuck everywhere, needs refresh"
    // symptom).
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    try {
      // { ideal } instead of a hard constraint — avoids slow renegotiation
      // (or an outright OverconstrainedError) on devices/browsers that don't
      // expose an exact match for "user".
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "user" } }, audio: false });
      streamRef.current = stream;
      // Don't touch videoRef here — the <video> element only exists once
      // cameraOn flips true and it mounts; attaching the stream happens in
      // the effect below, after that mount is guaranteed to have happened.
      setCameraOn(true);
    } catch (err) {
      // Log the real error for debugging, but never show raw error
      // names/messages to the customer — keep the on-screen copy plain.
      console.error("getUserMedia failed:", err);
      const denied = err instanceof Error && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      setCameraError(
        denied
          ? "Camera access is turned off for this site. Turn it on in your browser's site settings, then reload this page."
          : "We couldn't open your camera. Tap “Take photo” to try again.",
      );
    }
  }

  useEffect(() => {
    if (!cameraOn) return;
    if (!videoRef.current || !streamRef.current) {
      // A stream was granted but there's nothing to attach it to — leaving
      // it open here is exactly how the camera gets silently wedged with no
      // preview and no visible error. Release it and surface a real error
      // instead of failing silent.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
      setCameraError("We couldn't open your camera. Tap “Take photo” to try again.");
      return;
    }
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch((err) => {
      console.error("video.play() failed:", err);
      setCameraError("We couldn't open your camera. Tap “Take photo” to try again.");
    });
  }, [cameraOn]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    setPhotoUrl(dataUrl);
    stopCamera();
    // Jumping straight to the composited preview instead of leaving the user
    // on the "Photo ready" badge — after tapping Capture, expecting to
    // manually scroll down and hit a separate "Generate Frame" button reads
    // as broken (nothing visibly happens).
    void handleGenerate(dataUrl);
  }

  const canRender = Boolean(photoUrl);

  function resetPreview() { setPreviewUrl(""); }

  function pickFrame(next: FrameTemplate) {
    setFrame(next);
    resetPreview();
  }

  async function callRender(photo: string): Promise<string> {
    const res = await fetch("/api/frames/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // "hd" tier = no watermark, full resolution (see compose/tier.ts) — the
      // frame shop has no paid gate anymore, so every render gets that tier.
      body: JSON.stringify({ templateId: frame.id, photoDataUrl: photo, selection: {}, inputs: {}, tier: "hd" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Render failed");
    return json.imageUrl as string;
  }

  // Accepts an optional photo override so capturePhoto() can trigger this
  // right after canvas.toDataURL() resolves, without waiting a render cycle
  // for the photoUrl state update to land first.
  async function handleGenerate(photoOverride?: string) {
    const photo = photoOverride ?? photoUrl;
    if (!photo) return;
    setIsRendering(true);
    resetPreview();
    try {
      setPreviewUrl(await callRender(photo));
      window.setTimeout(
        () => document.getElementById("frame-preview")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80,
      );
    } catch (err) {
      console.error("Render failed:", err);
      alert("Sorry, something went wrong creating your frame. Tap “Generate Frame” to try again.");
    } finally {
      setIsRendering(false);
    }
  }

  async function handleDownload() {
    if (isInAppBrowser) {
      // Don't even attempt share/blob-download here — both are blocked
      // inside WeChat's webview, so the OS ends up showing its own
      // "open in browser" prompt with no context. Tell the customer the
      // exact tap sequence instead.
      alert(
        "Saving photos doesn't work inside WeChat's built-in browser. Tap “···” in the top-right corner, choose “Open in Browser” (在浏览器打开), then tap Download again there.",
      );
      return;
    }
    setIsDownloading(true);
    try {
      const url = previewUrl || (await callRender(photoUrl));
      await saveImage(url, `${frame.id}-frame.png`);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Sorry, something went wrong saving your photo. Tap “Download” to try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  // A plain `<a download>` on a data: URL is what produced the blank/broken
  // file the user saw — iOS Safari in particular doesn't reliably honor
  // `download` for data: URIs (frequently saves a truncated/unreadable
  // file), and it never lands in Photos, just Files.
  //
  // The Web Share API's file-sharing (Level 2, iOS Safari 15+ and Android
  // Chrome) hands the image to the OS share sheet, where "Save Image" saves
  // straight into the camera roll on both platforms — that's the actual
  // fix. Only fall back to the anchor-click/blob-URL approach where share
  // isn't available (desktop browsers), since that path is reliable there.
  async function saveImage(dataUrl: string, filename: string) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: blob.type || "image/png" });

    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return; // user cancelled the sheet
        // otherwise fall through to the blob-URL download below
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  }

  function FramePicker({ items }: { items: FrameTemplate[] }) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {items.map((f) => (
          <button key={f.id} type="button" onClick={() => pickFrame(f)}
            className={`relative overflow-hidden rounded-2xl border-2 transition ${
              frame.id === f.id ? "border-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.4)]" : "border-white/15 hover:border-white/35"
            }`}>
            <img src={f.thumbnail} alt={f.name} className="h-32 w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-1 text-center text-[0.6rem] font-black uppercase tracking-wide text-white">{f.name}</div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-12 right-0 h-72 w-72 rounded-full bg-slate-300/10 blur-3xl" />
        <div className="absolute bottom-0 h-40 w-full bg-[linear-gradient(to_top,rgba(2,6,23,0.95),transparent)]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-100">
            Soccer Fans World
          </Link>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-300">
            Frame Shop
          </span>
        </header>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="rounded-[2rem] border border-white/15 bg-slate-950/55 p-5 shadow-2xl backdrop-blur sm:p-7">
            <div className="mb-6">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.32em] text-emerald-200">Photo frame shop</p>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Frame your matchday photo.</h1>
              <p className="mt-3 leading-7 text-slate-300">
                Pick a frame, take a photo, and we composite a shareable keepsake.
              </p>
            </div>

            <div className="space-y-6">
              {dailyFrames.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-amber-300">Today&apos;s match • limited edition</p>
                  <FramePicker items={dailyFrames} />
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Choose frame</p>
                <FramePicker items={otherFrames} />
              </div>

              <button type="button" onClick={startCamera}
                className="block w-full rounded-3xl border border-dashed border-emerald-200/40 bg-emerald-300/10 p-5 text-center transition hover:bg-emerald-300/15">
                <span className="block text-lg font-black">Take photo</span>
                <span className="mt-1 block text-sm text-slate-300">Preview the frame live</span>
              </button>
              {photoUrl && !cameraOn ? (
                <span className="inline-flex rounded-full bg-emerald-300 px-4 py-2 text-sm font-black text-slate-950">Photo ready</span>
              ) : null}
              {cameraError ? <p className="text-sm text-rose-300">{cameraError}</p> : null}

              {cameraOn && (
                <div className="space-y-3">
                  <div className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[1.5rem] border-4 border-white/20 bg-black shadow-2xl" style={{ aspectRatio: `${frame.size.w} / ${frame.size.h}` }}>
                    {photoLayer && (
                      <video ref={videoRef} autoPlay playsInline muted
                        className="absolute object-cover"
                        style={{
                          left: `${(photoLayer.rect.x / frame.size.w) * 100}%`,
                          top: `${(photoLayer.rect.y / frame.size.h) * 100}%`,
                          width: `${(photoLayer.rect.w / frame.size.w) * 100}%`,
                          height: `${(photoLayer.rect.h / frame.size.h) * 100}%`,
                          transform: "scaleX(-1)",
                          borderRadius: photoLayer.mask === "circle" ? "9999px" : photoLayer.mask === "rounded" ? "2rem" : 0,
                        }} />
                    )}
                    {overlayLayers.map((layer, i) => (
                      <img key={i} src={layer.previewSrc ?? layer.src} alt="" className="pointer-events-none absolute inset-0 h-full w-full"
                        style={{ objectFit: layer.fit === "fill" ? "fill" : layer.fit }} />
                    ))}
                  </div>
                  <div className="flex justify-center gap-3">
                    <button type="button" onClick={capturePhoto}
                      className="rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-slate-100 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950">
                      Capture
                    </button>
                    <button type="button" onClick={stopCamera}
                      className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />

              <button type="button" onClick={() => handleGenerate()} disabled={!canRender || isRendering}
                className="w-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-slate-100 px-7 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_34px_rgba(52,211,153,0.28)] transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45">
                {isRendering ? "Compositing…" : "Generate Frame"}
              </button>
            </div>
          </div>

          <section id="frame-preview" className="flex flex-col items-center gap-5">
            <div className="relative aspect-[1080/1350] w-full max-w-[420px] overflow-hidden rounded-[1.5rem] border-4 border-white/20 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
              {previewUrl ? (
                <img src={previewUrl} alt="Framed preview" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-400">
                  {isRendering ? "Compositing your frame…" : "Your framed photo will appear here."}
                </div>
              )}
              {isRendering && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 text-slate-200">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                  <p className="text-xs font-bold uppercase tracking-widest">Compositing…</p>
                </div>
              )}
            </div>

            {previewUrl ? (
              <div className="flex flex-col items-center gap-3">
                {isInAppBrowser && (
                  <p className="max-w-xs text-center text-xs leading-5 text-amber-200">
                    Saving doesn't work inside WeChat's browser. Tap “···” top-right → “Open in Browser” (在浏览器打开) first.
                  </p>
                )}
                <button type="button" onClick={handleDownload} disabled={isDownloading}
                  className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-50">
                  {isDownloading ? "Preparing…" : "Download"}
                </button>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
