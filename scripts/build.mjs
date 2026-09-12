import { build } from "esbuild";
import { mkdir, rm, cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const entries = ["background", "content", "popup", "options", "offscreen"];

async function bundle() {
  await Promise.all(
    entries.map((name) =>
      build({
        absWorkingDir: root,
        entryPoints: [`src/${name}.ts`],
        outfile: `src/${name}.js`,
        bundle: true,
        format: "iife",
        platform: "browser",
        target: "es2022",
        logLevel: "info"
      })
    )
  );
}

async function copyInto(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, "src"), { recursive: true });
  await mkdir(path.join(dir, "icons"), { recursive: true });
  await mkdir(path.join(dir, "_locales/zh_TW"), { recursive: true });
  await mkdir(path.join(dir, "_locales/en"), { recursive: true });
  await cp(path.join(root, "manifest.json"), path.join(dir, "manifest.json"));
  await cp(path.join(root, "LICENSE"), path.join(dir, "LICENSE"));
  await cp(path.join(root, "README.md"), path.join(dir, "README.md"));
  await cp(path.join(root, "README.zh-TW.md"), path.join(dir, "README.zh-TW.md"));
  for (const name of entries) {
    await cp(path.join(root, "src", `${name}.js`), path.join(dir, "src", `${name}.js`));
  }
  for (const file of ["popup.html", "options.html", "offscreen.html", "ui.css"]) {
    await cp(path.join(root, "src", file), path.join(dir, "src", file));
  }
  for (const size of [16, 32, 48, 128]) {
    await cp(path.join(root, "icons", `icon${size}.png`), path.join(dir, "icons", `icon${size}.png`));
  }
  await cp(path.join(root, "_locales/zh_TW/messages.json"), path.join(dir, "_locales/zh_TW/messages.json"));
  await cp(path.join(root, "_locales/en/messages.json"), path.join(dir, "_locales/en/messages.json"));
  await cp(path.join(root, "examples"), path.join(dir, "examples"), { recursive: true });
}

function zipDir(source, zipPath) {
  const result = spawnSync(
    "python3",
    ["-c", "import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2])", zipPath.replace(/\.zip$/, ""), source],
    { cwd: root, stdio: "inherit" }
  );
  if (result.status !== 0) throw new Error("zip failed");
}

const mode = process.argv[2] || "build";
if (mode === "bundle" || mode === "build" || mode === "pack") {
  await bundle();
}
if (mode === "build" || mode === "pack") {
  const stage = path.join(dist, "extension");
  await copyInto(stage);
}
if (mode === "pack") {
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  const zipBase = path.join(dist, `select-translate-${manifest.version}`);
  zipDir(path.join(dist, "extension"), `${zipBase}.zip`);
  await writeFile(path.join(dist, "latest-name.txt"), `select-translate-${manifest.version}.zip`);
  console.log(`packed ${zipBase}.zip`);
}
