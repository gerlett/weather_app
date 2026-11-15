// Regenerates every app icon from scripts/icon-source.mjs.
//   node scripts/generate-icons.mjs
// Uses sharp (installed with Next.js) to rasterise the SVG.
import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { iconSvg } from "./icon-source.mjs";

const pub = new URL("../public/", import.meta.url);
const icons = new URL("icons/", pub);
mkdirSync(icons, { recursive: true });

const png = (variant, size, text = true) =>
  sharp(Buffer.from(iconSvg(variant, { text })), { density: 72 * (size / 512) * 4 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

const out = (url, buf) => {
  writeFileSync(url, buf);
  console.log("wrote", url.pathname.split("/public/")[1] ?? url.pathname);
};

// Vector icon for modern browsers
out(new URL("icon.svg", pub), iconSvg("rounded", { text: false }));

// PWA / Android / Windows desktop install
for (const s of [192, 512]) {
  out(new URL(`icon-${s}.png`, icons), await png("rounded", s));
  out(new URL(`maskable-${s}.png`, icons), await png("maskable", s));
}

// iOS home screen (opaque, iOS applies its own rounding)
out(new URL("apple-touch-icon.png", pub), await png("full", 180));

// Windows favicon / taskbar: multi-size ICO with PNG-encoded entries
const sizes = [16, 24, 32, 48, 64, 256];
const images = await Promise.all(sizes.map((s) => png("rounded", s, s >= 128)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s >= 256 ? 0 : s, e);
  header.writeUInt8(s >= 256 ? 0 : s, e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(images[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
out(new URL("favicon.ico", pub), Buffer.concat([header, ...images]));
