#!/usr/bin/env bash
# Reports which of the 12 Aurelia variant photographs are present, with
# dimensions. Dev helper only — the seed declares all 12, so re-seed once
# nothing is missing. Exit 0 = ready to seed, exit 1 = still waiting.
cd "$(dirname "$0")/.." || exit 1
node -e '
const { createRequire } = require("node:module");
const sharp = createRequire(process.cwd() + "/package.json")("sharp");
const fs = require("node:fs");
(async () => {
  let present = 0, missing = 0;
  for (const c of ["gold", "silver", "rose-gold"]) {
    for (const n of [1, 2, 3, 4]) {
      const name = `aurelia-${c}-${n}.jpg`;
      const f = `public/images/demo/${name}`;
      if (fs.existsSync(f)) {
        let dim = "?";
        try { const m = await sharp(f).metadata(); dim = `${m.width}x${m.height}`; } catch {}
        console.log(`  ok      ${name.padEnd(28)} ${String(fs.statSync(f).size).padStart(8)} bytes  ${dim}`);
        present++;
      } else {
        console.log(`  MISSING ${name}`);
        missing++;
      }
    }
  }
  console.log(`\npresent: ${present}/12   missing: ${missing}`);
  if (missing === 0) { console.log("All 12 present - safe to re-seed."); process.exit(0); }
  console.log("Still waiting on assets - do NOT re-seed yet (missing files would render as broken images).");
  process.exit(1);
})();
'
