import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden px-6 py-10 text-white">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute left-1/2 top-10 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-52 w-full bg-[linear-gradient(to_top,rgba(15,23,42,0.95),transparent)]" />
        <div className="absolute bottom-20 left-1/2 h-32 w-[115%] -translate-x-1/2 rounded-[100%] border border-emerald-300/20 bg-emerald-950/30" />
      </div>

      <section className="relative mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8 text-center lg:text-left">
          <p className="mx-auto w-fit rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.35em] text-emerald-100 lg:mx-0">
            Seattle matchday edition
          </p>
          <div className="space-y-5">
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              What&apos;s Your Matchday Fan Rating?
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-8 text-slate-200 lg:mx-0">
              Upload a real fan photo and turn your matchday energy into a premium soccer trading card with AI-style ratings, a stadium-ready identity, and a shareable PNG.
            </p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-slate-100 px-8 py-4 text-base font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_0_40px_rgba(52,211,153,0.35)] transition hover:scale-105"
          >
            Create My Card
          </Link>
        </div>

        <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-slate-200/20 bg-slate-950/50 p-4 shadow-2xl backdrop-blur">
          <div className="aspect-[2.5/3.5] rounded-[1.5rem] border border-emerald-200/40 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.55),transparent_38%),linear-gradient(160deg,#03101c,#0f2f46_45%,#03251d)] p-5">
            <div className="flex h-full flex-col justify-between rounded-[1.1rem] border border-slate-200/20 bg-white/5 p-4 text-center shadow-inner">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-100">Fan XI</p>
                <div className="mx-auto h-36 rounded-2xl border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.16),rgba(16,185,129,0.12))]" />
              </div>
              <div>
                <p className="text-4xl font-black">99</p>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-200">Style Captain</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold text-emerald-50">
                {['PAS', 'ENE', 'STY', 'LOY', 'STA', 'IMP'].map((stat) => (
                  <div key={stat} className="rounded-lg bg-slate-950/50 py-2">{stat}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
