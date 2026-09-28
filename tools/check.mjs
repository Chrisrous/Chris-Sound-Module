import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, relative, basename, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { STATUS_VALUES } from "../scripts/status.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const manifest = JSON.parse(read("module.json")), pkg = JSON.parse(read("package.json"));
assert.equal(manifest.id, "chris-sound-module"); assert.equal(manifest.version, pkg.version);
assert.equal(manifest.compatibility.minimum, "14"); assert.equal(manifest.compatibility.maximum, "14"); assert.equal(manifest.socket, true);
assert.equal(manifest.compatibility.verified, undefined, "Runtime verification must not be claimed by an untested RC");
for (const path of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(lang => lang.path)]) assert.ok(existsSync(resolve(root, path)), `Missing manifest asset: ${path}`);
const sources = readdirSync(resolve(root, "scripts")).filter(path => path.endsWith(".js"));
for (const path of sources) {
  const source = read(`scripts/${path}`);
  execFileSync(process.execPath, ["--check", resolve(root, "scripts", path)], { stdio: "pipe" });
  for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    const target = resolve(root, "scripts", match[1]), local = relative(root, target);
    assert.ok(!local.startsWith("..") && !isAbsolute(local), `Import outside repository: ${match[1]}`);
    assert.ok(readdirSync(dirname(target)).includes(basename(target)), `Missing/case-mismatched import: ${local}`);
  }
  assert.ok(!/\bFormApplication\b|new\s+Audio\s*\(|\$\s*\(/.test(source), `Legacy runtime API in ${path}`);
}
function flatten(value, prefix = "") {
  return Object.entries(value).flatMap(([key, entry]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    return typeof entry === "object" && entry !== null ? flatten(entry, full) : [full];
  });
}
const en = JSON.parse(read("lang/en.json")), de = JSON.parse(read("lang/de.json")), keys = new Set(flatten(en));
assert.deepEqual([...keys].sort(), flatten(de).sort(), "DE/EN localization keys differ");
for (const lang of [en, de]) for (const key of keys) {
  const value = key.split(".").reduce((object, part) => object[part], lang);
  assert.ok(typeof value === "string" && value.length, `Empty/non-string locale value: ${key}`);
}
const template = read("templates/soundpad.html"), combined = [...sources.map(path => read(`scripts/${path}`)), template].join("\n");
const used = [...combined.matchAll(/["'](CHRIS_SOUND_MODULE\.[A-Za-z.]+)["']/g)].map(match => match[1]);
used.push(...[...combined.matchAll(/\bmessage\(["']([A-Za-z.]+)["']/g)].map(match => `CHRIS_SOUND_MODULE.${match[1]}`));
used.push(...[...STATUS_VALUES].map(status => `CHRIS_SOUND_MODULE.Status.${status}`));
used.push("CHRIS_SOUND_MODULE.Error.startTimeout", "CHRIS_SOUND_MODULE.Error.playbackFailed");
for (const key of used) assert.ok(keys.has(key), `Missing localization: ${key}`);
const blocks = [];
for (const match of template.matchAll(/{{([#/])([a-z]+)[^}]*}}/g)) {
  if (match[1] === "#") blocks.push(match[2]); else assert.equal(blocks.pop(), match[2], "Mismatched Handlebars block");
}
assert.equal(blocks.length, 0, "Unclosed Handlebars block");
assert.ok(!template.includes("{{{"), "Unescaped HTML interpolation is not expected");
for (const [, action] of template.matchAll(/data-action="([A-Za-z]+)"/g)) assert.ok(read("scripts/SoundPad.js").includes(`"${action}"`), `Missing UI action ${action}`);
console.log(`Static checks passed: ${sources.length} runtime modules, ${keys.size} locale keys, case-sensitive imports, manifest assets, template blocks and actions.`);
console.log("Template checks are not a real Handlebars/Foundry render.");
