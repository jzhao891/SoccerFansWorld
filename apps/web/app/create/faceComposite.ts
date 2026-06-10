let modelsLoaded = false;

async function ensureModels() {
  if (modelsLoaded) return;
  const faceapi = await import("face-api.js");
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
  ]);
  modelsLoaded = true;
}

// Face at ~55% from top of canvas so it sits center-lower on the full card
const W = 300;
const H = 720;
const HEAD_CX = W / 2;
const HEAD_CY = 396;
const HEAD_R = 54;

export async function createFaceComposite(photoUrl: string): Promise<string> {
  const faceapi = await import("face-api.js");
  await ensureModels();

  const img = new Image();
  img.src = photoUrl;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });

  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
    .withFaceLandmarks(true); // true = use tiny landmark model

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, W, H);
  drawCartoonPlayer(ctx);

  // Clip face into head circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(HEAD_CX, HEAD_CY, HEAD_R, 0, Math.PI * 2);
  ctx.clip();

  if (detection) {
    const lm = detection.landmarks;

    // Use jaw outline for face width and chin position
    const jaw = lm.getJawOutline();
    const leftEyePts = lm.getLeftEye();
    const rightEyePts = lm.getRightEye();

    const avg = (pts: { x: number; y: number }[]) =>
      pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });

    const leftEyeCenter = avg(leftEyePts);
    const rightEyeCenter = avg(rightEyePts);
    const eyeMidY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

    const chinY = jaw[8].y; // bottom-center of chin
    const faceLeft = jaw[0].x;
    const faceRight = jaw[16].x;
    const faceW = faceRight - faceLeft;

    // Estimate forehead top: mirror the eyes-to-chin distance upward, plus a bit more
    const eyesToChin = chinY - eyeMidY;
    const foreheadTop = eyeMidY - eyesToChin * 1.05;

    // Crop rectangle with small horizontal margin
    const cropX = faceLeft - faceW * 0.12;
    const cropY = foreheadTop;
    const cropW = faceW * 1.24;
    const cropH = chinY - foreheadTop + faceW * 0.08; // slight chin buffer

    ctx.drawImage(img, cropX, cropY, cropW, cropH, HEAD_CX - HEAD_R, HEAD_CY - HEAD_R, HEAD_R * 2, HEAD_R * 2);
  } else {
    // Fallback: no face detected, centre-top crop
    const side = Math.min(img.width, img.height);
    ctx.drawImage(
      img,
      (img.width - side) / 2,
      0,
      side,
      side * 0.85,
      HEAD_CX - HEAD_R,
      HEAD_CY - HEAD_R,
      HEAD_R * 2,
      HEAD_R * 2
    );
  }
  ctx.restore();

  // White ring around face
  ctx.strokeStyle = "rgba(255,255,255,0.88)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(HEAD_CX, HEAD_CY, HEAD_R, 0, Math.PI * 2);
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

// All y-coordinates shifted by 324 so the player sits in the lower half of the canvas
function drawCartoonPlayer(ctx: CanvasRenderingContext2D) {
  const cx = HEAD_CX;

  const jersey = "#1a5c2e";
  const accent = "#ffffff";
  const shorts = "#0d3d1f";
  const skin = "#f0c090";
  const boot = "#1c1c2e";

  // Neck
  ctx.fillStyle = skin;
  ctx.fillRect(cx - 13, 447, 26, 25);

  // Jersey body
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.moveTo(cx - 68, 469);
  ctx.quadraticCurveTo(cx, 456, cx + 68, 469);
  ctx.lineTo(cx + 78, 564);
  ctx.quadraticCurveTo(cx, 576, cx - 78, 564);
  ctx.closePath();
  ctx.fill();

  // Vertical white stripe
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(cx - 11, 462);
  ctx.lineTo(cx + 11, 462);
  ctx.lineTo(cx + 13, 572);
  ctx.lineTo(cx - 13, 572);
  ctx.closePath();
  ctx.fill();

  // Left arm
  ctx.strokeStyle = jersey;
  ctx.lineWidth = 25;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 66, 476);
  ctx.quadraticCurveTo(cx - 94, 510, cx - 99, 538);
  ctx.stroke();

  // Right arm
  ctx.beginPath();
  ctx.moveTo(cx + 66, 476);
  ctx.quadraticCurveTo(cx + 94, 510, cx + 99, 538);
  ctx.stroke();

  // Hands
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx - 99, 541, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 99, 541, 12, 0, Math.PI * 2);
  ctx.fill();

  // Shorts
  ctx.fillStyle = shorts;
  ctx.beginPath();
  ctx.moveTo(cx - 78, 562);
  ctx.quadraticCurveTo(cx, 574, cx + 78, 562);
  ctx.lineTo(cx + 72, 618);
  ctx.lineTo(cx + 12, 618);
  ctx.lineTo(cx + 12, 601);
  ctx.lineTo(cx - 12, 601);
  ctx.lineTo(cx - 12, 618);
  ctx.lineTo(cx - 72, 618);
  ctx.closePath();
  ctx.fill();

  // Left shin
  ctx.strokeStyle = skin;
  ctx.lineWidth = 22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 37, 616);
  ctx.lineTo(cx - 43, 697);
  ctx.stroke();

  // Right shin
  ctx.beginPath();
  ctx.moveTo(cx + 37, 616);
  ctx.lineTo(cx + 43, 697);
  ctx.stroke();

  // Left boot
  ctx.fillStyle = boot;
  ctx.beginPath();
  ctx.ellipse(cx - 48, 704, 31, 13, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Right boot
  ctx.beginPath();
  ctx.ellipse(cx + 48, 704, 31, 13, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Boot shine
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx - 53, 700, 16, 5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 43, 700, 16, 5, 0.08, 0, Math.PI * 2);
  ctx.fill();
}
