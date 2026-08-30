/**
 * Generates the full PWA icon set (T190, research.md §23a) from the single
 * official logo asset at `public/brand/logo.svg` — never a separate
 * generated mark. Every output only adapts the surrounding canvas
 * (background color + padding); the logo artwork itself is rasterized
 * as-is, never redrawn or substituted.
 *
 * NOTE: `public/brand/logo.svg` is currently the project's documented
 * TEMPORARY PLACEHOLDER wordmark (see the comment inside that file) — this
 * script derives every icon from whatever that file currently contains, so
 * re-run it (`node scripts/generate-pwa-icons.mjs`) once the real official
 * ELORA JEWELLERY logo asset replaces the placeholder.
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LOGO_SVG = join(ROOT, "public/brand/logo.svg");
const ICONS_DIR = join(ROOT, "public/icons");

// Matches the manifest's `background_color`/theme (research.md §19/§23).
const BRAND_CREAM = "#fdf6ec";

mkdirSync(ICONS_DIR, { recursive: true });

/**
 * Renders the logo onto a square canvas of `size`×`size`, centered, scaled
 * to occupy `fillRatio` of the canvas's narrower dimension — never
 * cropping or redrawing the source artwork.
 */
async function renderIcon({ size, fillRatio, outputPath }) {
  const logoWidth = Math.round(size * fillRatio);
  const logoBuffer = await sharp(LOGO_SVG, { density: 384 })
    .resize({ width: logoWidth, fit: "inside" })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoBuffer).metadata();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_CREAM,
    },
  })
    .composite([
      {
        input: logoBuffer,
        left: Math.round((size - (logoMeta.width ?? logoWidth)) / 2),
        top: Math.round((size - (logoMeta.height ?? logoWidth)) / 2),
      },
    ])
    .png()
    .toFile(outputPath);

  console.log(`wrote ${outputPath}`);
}

async function packIco(pngBuffers, outputPath) {
  // Minimal "PNG-in-ICO" encoder — supported by every OS since Windows
  // Vista and every modern browser. Avoids pulling in a dedicated ICO
  // dependency for what is otherwise a one-off generation script.
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // no palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buffer.length;
    dirEntries.push(entry);
  }

  writeFileSync(outputPath, Buffer.concat([header, ...dirEntries, ...pngBuffers.map((p) => p.buffer)]));
  console.log(`wrote ${outputPath}`);
}

async function main() {
  await renderIcon({ size: 192, fillRatio: 0.72, outputPath: join(ICONS_DIR, "icon-192.png") });
  await renderIcon({ size: 512, fillRatio: 0.72, outputPath: join(ICONS_DIR, "icon-512.png") });
  // Maskable: fit within the ~80% center "safe zone" per W3C guidance —
  // scaled further down than the standard icons so nothing is clipped by
  // an OS mask shape.
  await renderIcon({ size: 512, fillRatio: 0.6, outputPath: join(ICONS_DIR, "icon-512-maskable.png") });
  await renderIcon({ size: 180, fillRatio: 0.72, outputPath: join(ICONS_DIR, "apple-touch-icon.png") });
  await renderIcon({ size: 32, fillRatio: 0.85, outputPath: join(ICONS_DIR, "favicon-32.png") });
  await renderIcon({ size: 16, fillRatio: 0.9, outputPath: join(ICONS_DIR, "favicon-16.png") });

  // Next.js App Router icon conventions (auto-generate the right <link>
  // tags — no manual metadata wiring needed for these two).
  await renderIcon({ size: 32, fillRatio: 0.85, outputPath: join(ROOT, "src/app/icon.png") });
  await renderIcon({ size: 180, fillRatio: 0.72, outputPath: join(ROOT, "src/app/apple-icon.png") });

  const [png32, png16] = await Promise.all([
    sharp(join(ICONS_DIR, "favicon-32.png")).toBuffer(),
    sharp(join(ICONS_DIR, "favicon-16.png")).toBuffer(),
  ]);
  await packIco(
    [
      { size: 16, buffer: png16 },
      { size: 32, buffer: png32 },
    ],
    join(ROOT, "src/app/favicon.ico"),
  );

  console.log("PWA icon set generated from public/brand/logo.svg.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
