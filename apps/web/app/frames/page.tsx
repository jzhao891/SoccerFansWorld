"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import type { AssetSelection, FrameTemplate, RenderTier } from "@sfw/shared";
import { FRAME_TEMPLATES, assetsForDimension } from "@/lib/frames/catalog";

export default function FramesPage() {
  const [frame, setFrame] = useState<FrameTemplate>(FRAME_TEMPLATES[0]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [selection, setSelection] = useState<AssetSelection>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // Required asset dimensions must be chosen before we can render.
  const missingRequired = useMemo(
    () =>
      frame.dimensions
        .filter((d) => d.required && !selection[d.dimension])
        .map((d) => d.dimension),
    [frame, selection],
  );

  const canRender = Boolean(photoUrl) && missingRequired.length === 0;

  function resetPreview() {
    setPreviewUrl("");
  }

  function pickFrame(next: FrameTemplate) {
    setFrame(next);
    setSelection({});
    setInputs({});
    resetPreview();
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(String(reader.result));
      resetPreview();
    };
    reader.readAsDataURL(file);
  }

  async function callRender(tier: RenderTier): Promise<string> {
    const res = await fetch("/api/frames/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: frame.id,
        photoDataUrl: photoUrl,
        selection,
        inputs,
        tier,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Render failed");
    return json.imageUrl as string;
  }

  async function handleGenerate() {
    if (!canRender) return;
    setIsRendering(true);
    resetPreview();
    try {
      setPreviewUrl(await callRender("free"));
      window.setTimeout(
        () => document.getElementById("frame-preview")?.scrollIntoView({ behavior: "smooth", block: "center" }),
        80,
      );
    } catch (err) {
      alert(`Could not generate frame: ${err}`);
    } finally {
      setIsRendering(false);
    }
  }

  async function handleDownload(hd: boolean) {
    if (hd && !isPremium) {
      alert("HD download without watermark is a Premium feature. Unlock to remove the watermark and export full resolution.");
      return;
    }
    setIsDownloading(true);
    try {
      const url = hd ? await callRender("hd") : previewUrl || (await callRender("free"));
      const link = document.createElement("a");
      link.download = `${frame.id}-${hd ? "hd" : "preview"}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      alert(`Download failed: ${err}`);
    } finally {
      setIsDownloading(false);
    }
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
            Frame Shop • Demo
          </span>
        </header>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          {/* ── Controls ───────────────────────────────────────────── */}
          <div className="rounded-[2rem] border border-white/15 bg-slate-950/55 p-5 shadow-2xl backdrop-blur sm:p-7">
            <div className="mb-6">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.32em] text-emerald-200">Photo frame shop</p>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Frame your matchday photo.</h1>
              <p className="mt-3 leading-7 text-slate-300">
                Upload a photo, pick a frame, choose the scene, and we composite a shareable keepsake.
              </p>
            </div>

            <div className="space-y-6">
              {/* Upload */}
              <label className="block rounded-3xl border border-dashed border-emerald-200/40 bg-emerald-300/10 p-5 text-center transition hover:bg-emerald-300/15">
                <input type="file" accept="image/*" onChange={handlePhoto} className="sr-only" />
                <span className="block text-lg font-black">Upload photo</span>
                <span className="mt-1 block text-sm text-slate-300">JPG or PNG</span>
                {photoUrl ? (
                  <span className="mt-4 inline-flex rounded-full bg-emerald-300 px-4 py-2 text-sm font-black text-slate-950">
                    Photo ready
                  </span>
                ) : null}
              </label>

              {/* Frame picker */}
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Choose frame</p>
                <div className="grid grid-cols-3 gap-2">
                  {FRAME_TEMPLATES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => pickFrame(f)}
                      className={`relative overflow-hidden rounded-2xl border-2 transition ${
                        frame.id === f.id
                          ? "border-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.4)]"
                          : "border-white/15 hover:border-white/35"
                      }`}
                    >
                      <img src={f.thumbnail} alt={f.name} className="h-32 w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-1 text-center text-[0.6rem] font-black uppercase tracking-wide text-white">
                        {f.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-dimension asset pickers */}
              {frame.dimensions.map(({ dimension, required }) => (
                <div key={dimension}>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-emerald-200">
                    {dimension}
                    {required ? <span className="text-emerald-400"> *</span> : <span className="text-slate-500"> (optional)</span>}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {assetsForDimension(dimension).map((asset) => {
                      const active = selection[dimension] === asset.value;
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            setSelection((prev) => ({
                              ...prev,
                              [dimension]: active && !required ? undefined : asset.value,
                            }));
                            resetPreview();
                          }}
                          className={`relative overflow-hidden rounded-2xl border-2 transition ${
                            active
                              ? "border-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.4)]"
                              : "border-white/15 hover:border-white/35"
                          }`}
                        >
                          <img src={asset.thumbnail ?? asset.src} alt={asset.label} className="h-20 w-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-1 text-center text-[0.55rem] font-black uppercase tracking-wide text-white">
                            {asset.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Text inputs */}
              {frame.inputs.length > 0 && (
                <div className="grid gap-4">
                  {frame.inputs.map((field) => (
                    <label key={field.id} className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-200">{field.label}</span>
                      <input
                        value={inputs[field.id] ?? ""}
                        placeholder={field.placeholder}
                        maxLength={field.maxLength}
                        onChange={(e) => {
                          const value = e.target.value;
                          setInputs((prev) => ({ ...prev, [field.id]: value }));
                          resetPreview();
                        }}
                        className="w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none ring-emerald-300/30 transition placeholder:text-slate-500 focus:border-emerald-200 focus:ring-4"
                      />
                    </label>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canRender || isRendering}
                className="w-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-slate-100 px-7 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_34px_rgba(52,211,153,0.28)] transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isRendering ? "Compositing…" : "Generate Frame"}
              </button>
              {!canRender && photoUrl && missingRequired.length > 0 && (
                <p className="text-center text-xs text-amber-300">
                  Pick a {missingRequired.join(", ")} to continue.
                </p>
              )}
            </div>
          </div>

          {/* ── Preview ────────────────────────────────────────────── */}
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
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownload(false)}
                    disabled={isDownloading}
                    className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {isDownloading ? "Preparing…" : "Download (Free)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(true)}
                    disabled={isDownloading}
                    className="flex items-center gap-2 rounded-full border border-emerald-200/30 bg-gradient-to-r from-emerald-300 to-teal-200 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-xl transition hover:scale-105 disabled:opacity-50"
                  >
                    {!isPremium && <span aria-hidden>🔒</span>}
                    Download HD
                  </button>
                </div>
                <p className="text-center text-xs text-slate-400">
                  {isPremium ? "Premium unlocked — HD export, no watermark." : "Free version is watermarked and low-resolution."}{" "}
                  <button
                    type="button"
                    onClick={() => setIsPremium((v) => !v)}
                    className="font-bold text-emerald-300 underline underline-offset-2"
                  >
                    {isPremium ? "Lock again (demo)" : "Unlock Premium (demo)"}
                  </button>
                </p>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
