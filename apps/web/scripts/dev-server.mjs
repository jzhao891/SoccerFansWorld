import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || 3000);
const nextBin = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");

if (existsSync(nextBin)) {
  const nextProcess = spawn(nextBin, ["dev", "-p", String(port)], {
    stdio: "inherit",
    env: process.env,
  });

  nextProcess.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
} else {
  startFallbackPreview();
}

function startFallbackPreview() {
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || `localhost:${port}`}`);

    if (url.pathname === "/" || url.pathname === "/create") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(renderPage(url.pathname));
      return;
    }

    if (url.pathname.startsWith("/app/") || url.pathname.startsWith("/scripts/")) {
      const filePath = join(process.cwd(), url.pathname.slice(1));
      if (existsSync(filePath)) {
        response.writeHead(200, { "content-type": mimeType(filePath) });
        response.end(readFileSync(filePath));
        return;
      }
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  server.listen(port, () => {
    console.log(`Dependencies are not installed, so Next.js cannot start.`);
    console.log(`Serving dependency-free preview instead: http://localhost:${port}`);
    console.log(`Install packages successfully and this command will automatically run: next dev -p ${port}`);
  });
}

function mimeType(filePath) {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

function renderPage(pathname) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Soccer Fans World</title>
  <style>${styles()}</style>
</head>
<body>
  ${pathname === "/create" ? createPage() : landingPage()}
  <script>${clientScript()}</script>
</body>
</html>`;
}

function landingPage() {
  return `<main class="landing">
    <div class="orb orb-a"></div><div class="orb orb-b"></div><div class="pitch"></div>
    <section class="hero">
      <div class="copy">
        <p class="eyebrow">Seattle matchday edition</p>
        <h1>What’s Your Matchday Fan Rating?</h1>
        <p class="lead">Upload a real fan photo and turn your matchday energy into a premium soccer trading card with AI-style ratings, a stadium-ready identity, and a shareable PNG.</p>
        <a class="cta" href="/create">Create My Card</a>
      </div>
      <div class="teaser-card">
        <div class="card-frame teaser-inner">
          <p class="micro">Fan XI</p>
          <div class="photo-placeholder"></div>
          <div class="rating">99</div>
          <p class="archetype">Style Captain</p>
          <div class="mini-stats"><span>PAS</span><span>ENE</span><span>STY</span><span>LOY</span><span>STA</span><span>IMP</span></div>
        </div>
      </div>
    </section>
  </main>`;
}

function createPage() {
  return `<main class="app-shell">
    <header class="topbar"><a href="/">Soccer Fans World</a><span>Demo mode • Mock AI</span></header>
    <section class="workspace">
      <form class="panel" id="card-form">
        <p class="eyebrow">Create your card</p>
        <h1>Upload your matchday look.</h1>
        <p class="lead small">Add a real photo, share a few optional details, then generate a Seattle-inspired premium fan card.</p>
        <label class="upload-box"><input id="photo" type="file" accept="image/*" /><strong>Upload photo</strong><small>JPG, PNG, or HEIC-style image files</small><span id="photo-ready"></span></label>
        <label>Name<input id="name" placeholder="Maya" /></label>
        <label>Favorite team<input id="team" placeholder="Seattle Sounders" /></label>
        <label>City<input id="city" placeholder="Seattle" /></label>
        <button type="submit" class="button">Generate Card</button>
      </form>
      <section class="result" id="result"><div class="empty"><h2>Your card preview will appear here.</h2><p>Upload a photo and generate the mock AI card to unlock the PNG download workflow.</p></div></section>
    </section>
  </main>`;
}

function styles() {
  return `*{box-sizing:border-box}body{margin:0;min-height:100vh;color:#eef7f2;background:radial-gradient(circle at 20% 15%,rgba(16,185,129,.22),transparent 30%),radial-gradient(circle at 80% 10%,rgba(148,163,184,.22),transparent 26%),linear-gradient(135deg,#03101c 0%,#061521 45%,#092f2a 100%);font-family:Arial,Helvetica,sans-serif}a{color:inherit;text-decoration:none}.landing{position:relative;min-height:100vh;display:flex;align-items:center;overflow:hidden;padding:40px 24px}.orb{position:absolute;border-radius:999px;filter:blur(70px);opacity:.7}.orb-a{top:20px;left:45%;width:260px;height:260px;background:rgba(52,211,153,.3)}.orb-b{right:0;bottom:0;width:320px;height:320px;background:rgba(148,163,184,.16)}.pitch{position:absolute;left:-5%;right:-5%;bottom:70px;height:150px;border:1px solid rgba(110,231,183,.18);border-radius:100%;background:rgba(6,78,59,.22)}.hero{position:relative;max-width:1150px;margin:auto;display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}.copy{text-align:left}.eyebrow{display:inline-block;border:1px solid rgba(110,231,183,.32);background:rgba(52,211,153,.12);border-radius:999px;padding:9px 14px;color:#d1fae5;text-transform:uppercase;font-size:12px;font-weight:900;letter-spacing:.32em}h1{font-size:clamp(42px,9vw,88px);line-height:.95;margin:22px 0;font-weight:1000;letter-spacing:-.055em}.lead{max-width:650px;color:#cbd5e1;font-size:18px;line-height:1.7}.small{font-size:16px}.cta,.button{display:inline-flex;justify-content:center;align-items:center;border:0;border-radius:999px;background:linear-gradient(90deg,#6ee7b7,#ccfbf1,#f8fafc);color:#020617;padding:16px 28px;font-weight:1000;text-transform:uppercase;letter-spacing:.18em;box-shadow:0 0 36px rgba(52,211,153,.32);cursor:pointer}.teaser-card{max-width:380px;margin:auto;border:1px solid rgba(226,232,240,.2);border-radius:32px;background:rgba(2,6,23,.52);padding:16px;box-shadow:0 30px 90px rgba(0,0,0,.45)}.card-frame{aspect-ratio:2.5/3.5;border:6px solid #e2e8f0;border-radius:28px;background:radial-gradient(circle at 50% 0%,rgba(52,211,153,.6),transparent 32%),linear-gradient(160deg,#03101c,#123d56 48%,#03251d);padding:20px;overflow:hidden}.teaser-inner{text-align:center;display:flex;flex-direction:column;justify-content:space-between}.micro{font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.35em;color:#d1fae5}.photo-placeholder{height:38%;border-radius:20px;border:1px solid rgba(255,255,255,.22);background:linear-gradient(145deg,rgba(255,255,255,.18),rgba(16,185,129,.14))}.rating{font-size:56px;font-weight:1000}.archetype{text-transform:uppercase;letter-spacing:.24em;font-weight:900;color:#e2e8f0}.mini-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.mini-stats span{background:rgba(2,6,23,.56);border-radius:10px;padding:9px 0;font-size:12px;font-weight:900}.app-shell{min-height:100vh;padding:24px}.topbar{max-width:1150px;margin:0 auto 32px;display:flex;justify-content:space-between;gap:16px;align-items:center}.topbar a{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.25em;color:#d1fae5}.topbar span{border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 12px;color:#cbd5e1;font-size:12px}.workspace{max-width:1150px;margin:auto;display:grid;grid-template-columns:.9fr 1.1fr;gap:32px;align-items:start}.panel,.empty{border:1px solid rgba(255,255,255,.14);border-radius:32px;background:rgba(2,6,23,.56);padding:28px;box-shadow:0 30px 90px rgba(0,0,0,.35);backdrop-filter:blur(10px)}.panel h1{font-size:clamp(36px,6vw,54px)}label{display:block;margin-top:16px;color:#e2e8f0;font-weight:800}.upload-box{border:1px dashed rgba(167,243,208,.42);border-radius:24px;background:rgba(52,211,153,.1);padding:22px;text-align:center;cursor:pointer}.upload-box input{display:none}.upload-box strong,.upload-box small,.upload-box span{display:block}.upload-box small{margin-top:6px;color:#cbd5e1;font-weight:400}#photo-ready{margin-top:12px;color:#020617;background:#6ee7b7;border-radius:999px;font-weight:1000;padding:8px;display:none}input{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(2,6,23,.72);color:white;padding:13px 15px;font:inherit;outline:none}.button{width:100%;margin-top:22px}.result{display:flex;flex-direction:column;align-items:center;gap:20px}.empty{width:100%;min-height:520px;display:grid;place-items:center;text-align:center}.fan-card{position:relative;width:min(100%,390px);aspect-ratio:2.5/3.5;border:6px solid #e2e8f0;border-radius:32px;overflow:hidden;background:#020617;padding:12px;box-shadow:0 30px 90px rgba(0,0,0,.5)}.fan-card:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,rgba(52,211,153,.6),transparent 32%),linear-gradient(160deg,#03101c,#123d56 48%,#03251d)}.skyline{position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(to top,rgba(148,163,184,.28),transparent);clip-path:polygon(0 55%,18% 40%,28% 55%,42% 28%,54% 48%,67% 24%,78% 54%,90% 38%,100% 56%,100% 100%,0 100%)}.inner{position:relative;height:100%;border:1px solid rgba(255,255,255,.35);border-radius:22px;background:rgba(255,255,255,.07);padding:14px;display:flex;flex-direction:column}.card-head{display:flex;justify-content:space-between;gap:12px}.card-head h2{font-size:24px;line-height:1;margin:6px 0 0;text-transform:uppercase}.ovr{background:rgba(2,6,23,.72);border:1px solid rgba(209,250,229,.4);border-radius:16px;padding:8px 12px;text-align:center}.ovr b{display:block;color:#a7f3d0;font-size:40px;line-height:.9}.photo{position:relative;flex:1;min-height:0;margin:12px 0;border-radius:18px;overflow:hidden;border:1px solid rgba(241,245,249,.3);background:#020617}.photo img{width:100%;height:100%;object-fit:cover}.photo:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(2,6,23,.88),transparent 58%,rgba(5,150,105,.18))}.identity{position:absolute;left:12px;right:12px;bottom:12px;z-index:2}.identity b{display:block;font-size:30px;line-height:.95;text-transform:uppercase}.identity span{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.2em;color:#d1fae5}.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.stat{border:1px solid rgba(255,255,255,.1);background:rgba(2,6,23,.62);border-radius:12px;padding:8px}.stat-row{display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:.13em;font-weight:1000;color:#cbd5e1}.bar{height:6px;margin-top:6px;border-radius:999px;background:#334155;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,#6ee7b7,#f8fafc)}.traits{margin-top:10px;border:1px solid rgba(209,250,229,.25);border-radius:18px;background:rgba(6,78,59,.66);padding:10px;font-size:12px}.trait-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.traits h3{font-size:10px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.2em;color:#a7f3d0}.traits p{margin:0;font-weight:800}.quote{border-top:1px solid rgba(255,255,255,.1);margin-top:8px;padding-top:8px;text-align:center;font-style:italic}.download{border:1px solid rgba(167,243,208,.3);background:white;color:#020617;border-radius:999px;padding:13px 24px;font-weight:1000;text-transform:uppercase;letter-spacing:.18em;cursor:pointer}@media(max-width:860px){.hero,.workspace{grid-template-columns:1fr}.copy{text-align:center}.eyebrow{margin:auto}.lead{margin-left:auto;margin-right:auto}.topbar{align-items:flex-start}.app-shell{padding:20px 14px}}`;
}

function clientScript() {
  return `const data={archetype:"Style Captain",stats:{passion:89,energy:82,style:99,loyalty:91,stamina:72,crowdImpact:87},specialAbility:"Rainproof Glamour",weakness:"Will stop for every photo opportunity.",description:"Turns matchday into a runway without missing kickoff."};let photoUrl="";const photo=document.getElementById("photo");if(photo){photo.addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{photoUrl=String(r.result);const ready=document.getElementById("photo-ready");ready.textContent="Photo ready";ready.style.display="block"};r.readAsDataURL(f)});document.getElementById("card-form").addEventListener("submit",e=>{e.preventDefault();if(!photoUrl){alert("Upload a photo first.");return}renderCard()})}function value(id,fallback){return(document.getElementById(id)?.value||"").trim()||fallback}function renderCard(){const name=value("name","Emerald Regular"),team=value("team","Seattle FC"),city=value("city","Seattle");const avg=Math.round(Object.values(data.stats).reduce((a,b)=>a+b,0)/6);const stats=[["passion","Passion"],["energy","Energy"],["style","Style"],["loyalty","Loyalty"],["stamina","Stamina"],["crowdImpact","Crowd Impact"]];document.getElementById("result").innerHTML='<div class="fan-card" id="fan-card"><div class="skyline"></div><div class="inner"><div class="card-head"><div><p class="micro">Fan rating</p><h2>'+data.archetype+'</h2></div><div class="ovr"><b>'+avg+'</b><small>OVR</small></div></div><div class="photo"><img src="'+photoUrl+'" alt="Fan photo"><div class="identity"><b>'+escapeHtml(name)+'</b><span>'+escapeHtml(team)+' • '+escapeHtml(city)+'</span></div></div><div class="stats">'+stats.map(s=>'<div class="stat"><div class="stat-row"><span>'+s[1]+'</span><b>'+data.stats[s[0]]+'</b></div><div class="bar"><div class="fill" style="width:'+data.stats[s[0]]+'%"></div></div></div>').join("")+'</div><div class="traits"><div class="trait-grid"><div><h3>Special Ability</h3><p>'+data.specialAbility+'</p></div><div><h3>Weakness</h3><p>'+data.weakness+'</p></div></div><p class="quote">“'+data.description+'”</p></div></div></div><button class="download" id="download">Download PNG</button>';document.getElementById("download").addEventListener("click",()=>downloadCanvas(name,team,city,avg))}function escapeHtml(v){return v.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;"}[c]))}function downloadCanvas(name,team,city,avg){const c=document.createElement("canvas"),ctx=c.getContext("2d"),img=new Image();c.width=1080;c.height=1512;img.onload=()=>{const g=ctx.createLinearGradient(0,0,1080,1512);g.addColorStop(0,"#03101c");g.addColorStop(.5,"#123d56");g.addColorStop(1,"#03251d");ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle="#e2e8f0";ctx.lineWidth=24;roundRect(ctx,24,24,1032,1464,72);ctx.stroke();ctx.save();roundRect(ctx,92,250,896,560,48);ctx.clip();ctx.drawImage(img,92,250,896,560);ctx.restore();ctx.fillStyle="rgba(2,6,23,.78)";ctx.fillRect(92,690,896,120);ctx.fillStyle="#fff";ctx.font="900 74px Arial";ctx.fillText(name.toUpperCase(),120,755);ctx.fillStyle="#a7f3d0";ctx.font="900 28px Arial";ctx.fillText((team+" • "+city).toUpperCase(),120,795);ctx.fillStyle="#a7f3d0";ctx.font="900 120px Arial";ctx.fillText(String(avg),820,150);ctx.fillStyle="#fff";ctx.font="900 58px Arial";ctx.fillText(data.archetype.toUpperCase(),92,170);const entries=[["Passion",89],["Energy",82],["Style",99],["Loyalty",91],["Stamina",72],["Crowd Impact",87]];ctx.font="900 30px Arial";entries.forEach((s,i)=>{const x=92+(i%2)*458,y=880+Math.floor(i/2)*95;ctx.fillStyle="rgba(2,6,23,.62)";roundRect(ctx,x,y,410,68,20);ctx.fill();ctx.fillStyle="#e2e8f0";ctx.fillText(s[0].toUpperCase(),x+20,y+43);ctx.fillStyle="#a7f3d0";ctx.fillText(String(s[1]),x+340,y+43)});ctx.fillStyle="rgba(6,78,59,.72)";roundRect(ctx,92,1180,896,210,36);ctx.fill();ctx.fillStyle="#a7f3d0";ctx.font="900 24px Arial";ctx.fillText("SPECIAL ABILITY",120,1235);ctx.fillText("WEAKNESS",570,1235);ctx.fillStyle="#fff";ctx.font="700 31px Arial";ctx.fillText(data.specialAbility,120,1280);ctx.fillText(data.weakness,570,1280,360);ctx.font="italic 34px Arial";ctx.fillText("“"+data.description+"”",120,1360,840);const a=document.createElement("a");a.download=name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-fan-card.png";a.href=c.toDataURL("image/png");a.click()};img.src=photoUrl}function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}`;
}
