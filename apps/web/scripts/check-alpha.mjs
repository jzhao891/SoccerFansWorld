import sharp from "sharp";

const file = process.argv[2];
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const px = (x, y) => {
  const i = (y * width + x) * 4;
  return `rgba(${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]})`;
};
console.log(`${file}  ${width}x${height}`);
console.log(`  top-left     ${px(0, 0)}`);
console.log(`  top-right    ${px(width - 1, 0)}`);
console.log(`  bottom-left  ${px(0, height - 1)}`);
console.log(`  center       ${px(width >> 1, height >> 1)}`);
