// Сборка одного exe: сервер, интерфейс и C-исходник пиков внутри. ffmpeg остаётся внешним.

import { rm } from "node:fs/promises";
import pkg from "../package.json" with { type: "json" };

const outdir = "dist";
const isWindows = process.platform === "win32";
const outfile = `${outdir}/ki-video${isWindows ? ".exe" : ""}`;

await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./src/server/main.ts"],
  target: "bun",
  minify: true,
  sourcemap: "none",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  compile: {
    outfile,
    ...(isWindows
      ? {
          windows: {
            hideConsole: true,
            title: "ki-video",
            description: "Быстрый монтаж вертикальных роликов",
            version: `${pkg.version}.0`,
          },
        }
      : {}),
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const size = Bun.file(outfile).size;
console.log(`собрано: ${outfile} (${(size / 1024 / 1024).toFixed(1)} МБ)`);
console.log("рядом с exe положи ki.config.json (см. ki.config.example.json) или задай KI_FFMPEG_DIR");
