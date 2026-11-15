// Master artwork for the app logo: a sun rising behind a cloud on a deep
// sky gradient, with the "I like Thurnhof" lettering (bold condensed type,
// yellow→orange face, dark-red 3D extrusion, slight upward tilt).
// `variant`:
//   "rounded"  – rounded square with transparent corners (favicon, desktop, Windows)
//   "full"     – full-bleed square (iOS rounds it itself; no transparency allowed)
//   "maskable" – full-bleed with artwork shrunk into the Android safe zone
// `text`: include the lettering. Off for tiny sizes (favicon ≤ 64 px) where it
// can't be read, and for the served icon.svg, which can't rely on the font.

export function iconSvg(variant = "rounded", { text = true } = {}) {
  const scale = variant === "maskable" ? 0.66 : 1;
  const rx = variant === "rounded" ? 112 : 0;

  // Skip the two rays pointing down into the cloud (they'd peek out below it).
  const rays = [0, 1, 4, 5, 6, 7].map((i) => {
    const a = (i * Math.PI) / 4 - Math.PI / 8;
    const r1 = 106;
    const r2 = 134;
    const x1 = 196 + Math.cos(a) * r1;
    const y1 = 196 + Math.sin(a) * r1;
    const x2 = 196 + Math.cos(a) * r2;
    const y2 = 196 + Math.sin(a) * r2;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join("");

  const cloud = `
    <circle cx="200" cy="302" r="62"/>
    <circle cx="292" cy="272" r="86"/>
    <circle cx="372" cy="320" r="52"/>
    <rect x="128" y="300" width="296" height="92" rx="46"/>`;

  // Sun + cloud: centred alone, or shrunk into the top half above the text.
  const artTransform = text
    ? "translate(256 160) scale(0.62) translate(-241 -226)"
    : "translate(15 30)";

  const lettering = text
    ? letteringSvg(
        [
          { str: "I like", y: 340, size: 82, len: 180 },
          { str: "Thurnhof", y: 440, size: 118, len: 372 },
        ],
        { cx: 256, rotate: "rotate(-7 256 400)" },
      )
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#0284c7"/>
      <stop offset="0.55" stop-color="#0c3a66"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <radialGradient id="glow" cx="196" cy="196" r="230" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fde68a" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#fde68a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fef08a"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
    <linearGradient id="cloud" x1="0" y1="186" x2="0" y2="392" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#bfdbfe"/>
    </linearGradient>
    ${LETTERING_DEFS}
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#sky)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <g transform="${artTransform}">
      <circle cx="196" cy="196" r="230" fill="url(#glow)"/>
      <g stroke="#fcd34d" stroke-width="22" stroke-linecap="round">${rays}</g>
      <circle cx="196" cy="196" r="80" fill="url(#sun)"/>
      <g fill="#020617" opacity="0.28" transform="translate(0 14)">${cloud}</g>
      <g fill="url(#cloud)">${cloud}</g>
    </g>
    ${lettering}
  </g>
</svg>
`;
}

const LETTERING_DEFS = `<linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fcd34d"/>
      <stop offset="0.5" stop-color="#fbbf24"/>
      <stop offset="1" stop-color="#f97316"/>
    </linearGradient>
    <linearGradient id="side" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c2410c"/>
      <stop offset="1" stop-color="#7c2d12"/>
    </linearGradient>`;

// 3D lettering: a stack of dark-red copies offset down-left (the extrusion),
// topped by the yellow→orange face. Needs the Impact font when rasterised.
function letteringSvg(lines, { cx, rotate, depth = 12 }) {
  const word = (l, attrs) =>
    `<text x="${cx}" y="${l.y}" font-size="${l.size}" textLength="${l.len}" lengthAdjust="spacingAndGlyphs" ${attrs}>${l.str}</text>`;
  const body = lines
    .map((l) => {
      const extrusion = Array.from({ length: depth }, (_, k) => {
        const d = depth - k;
        return word(l, `fill="${d === depth ? "#3b0a05" : "url(#side)"}" transform="translate(${(-0.55 * d).toFixed(2)} ${d})"`);
      }).join("");
      return extrusion + word(l, `fill="url(#face)" stroke="#7c2d12" stroke-width="1.5" paint-order="stroke"`);
    })
    .join("");
  return `<g font-family="Impact, 'Haettenschweiler', 'Arial Black', sans-serif" text-anchor="middle" transform="${rotate}">${body}</g>`;
}

