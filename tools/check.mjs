import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { STATUS_VALUES } from "../scripts/status.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = path => readFileSync(resolve(root, path), "utf8");
function files(directory) {
    return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
        const path = `${directory}/${entry.name}`;
        return entry.isDirectory() ? files(path) : [path];
    });
}
function exactPath(path) {
    const local = relative(root, path);
    assert.ok(!local.startsWith("..") && !isAbsolute(local), `Path leaves repo: ${path}`);
    assert.ok(existsSync(path), `Missing file: ${local}`);
    assert.ok(readdirSync(dirname(path)).includes(basename(path)), `Wrong-case path: ${local}`);
}
const manifest = JSON.parse(read("module.json"));
const pkg = JSON.parse(read("package.json"));
assert.equal(manifest.id, "chris-sound-module");
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.compatibility.minimum, "14");
assert.equal(manifest.compatibility.maximum, "14");
if (/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    const approval = JSON.parse(read(".github/release-approval.json"));
    assert.equal(approval.approved, true, "Stable releases require recorded owner acceptance");
    assert.equal(approval.version, manifest.version);
    assert.equal(approval.foundry_generation, "14");
    assert.equal(manifest.compatibility.verified, approval.exact_foundry_build ?? approval.foundry_generation);
    assert.match(approval.tested_commit, /^[a-f0-9]{40}$/);
    assert.equal(manifest.manifest, "https://raw.githubusercontent.com/Chrisrous/Chris-Sound-Module/main/module.json");
    assert.equal(manifest.download, `https://github.com/Chrisrous/Chris-Sound-Module/releases/download/v${manifest.version}/chris-sound-module.zip`);
    const runtimeFiles = ["scripts", "templates", "css", "lang"].flatMap(files).sort();
    assert.deepEqual(Object.keys(approval.runtime_sha256).sort(), runtimeFiles, "Accepted runtime inventory differs");
    for (const path of runtimeFiles) {
        const actual = createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
        assert.equal(actual, approval.runtime_sha256[path], `Accepted runtime changed: ${path}`);
    }
} else {
    assert.equal(manifest.compatibility.verified, undefined, "Unaccepted candidates must not claim live certification");
}
assert.equal(manifest.socket, true);
for (const path of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(lang => lang.path)]) exactPath(resolve(root, path));
const sources = files("scripts").filter(path => path.endsWith(".js"));
for (const path of [...sources, ...files("tools").filter(path => path.endsWith(".mjs")), ...files("tests").filter(path => path.endsWith(".js"))]) {
    const source = read(path);
    execFileSync(process.execPath, ["--check", resolve(root, path)], { stdio: "pipe" });
    if (!sources.includes(path)) continue;
    for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
        assert.ok(match[1].startsWith("."), `Unexpected runtime dependency: ${match[1]}`);
        exactPath(resolve(root, dirname(path), match[1]));
    }
    assert.ok(!/\bFormApplication\b|new\s+Audio\s*\(|\$\s*\(/.test(source), `Legacy runtime API: ${path}`);
}
function flatten(value, prefix = "") {
    return Object.entries(value).flatMap(([key, entry]) => {
        const full = prefix ? `${prefix}.${key}` : key;
        return typeof entry === "object" && entry !== null ? flatten(entry, full) : [full];
    });
}
const en = JSON.parse(read("lang/en.json")), de = JSON.parse(read("lang/de.json"));
const keys = new Set(flatten(en));
assert.deepEqual([...keys].sort(), flatten(de).sort(), "Locale keys differ");
for (const lang of [en, de]) for (const key of keys) {
    const value = key.split(".").reduce((object, part) => object[part], lang);
    assert.ok(typeof value === "string" && value.length, `Empty locale: ${key}`);
}
const template = read("templates/soundpad.html");
const combined = [...sources.map(read), template].join("\n");
const used = [...combined.matchAll(/["'](CHRIS_SOUND_MODULE\.[A-Za-z.]+)["']/g)].map(match => match[1]);
used.push(...[...combined.matchAll(/\bmessage\(["']([A-Za-z.]+)["']/g)].map(match => `CHRIS_SOUND_MODULE.${match[1]}`));
used.push(...[...STATUS_VALUES].map(status => `CHRIS_SOUND_MODULE.Status.${status}`));
used.push("CHRIS_SOUND_MODULE.Error.startTimeout", "CHRIS_SOUND_MODULE.Error.playbackFailed");
for (const key of used) assert.ok(keys.has(key), `Missing localization: ${key}`);
const blocks = [];
for (const match of template.matchAll(/{{([#/])([a-z]+)[^}]*}}/g)) {
    if (match[1] === "#") blocks.push(match[2]);
    else assert.equal(blocks.pop(), match[2], "Mismatched template block");
}
assert.equal(blocks.length, 0);
assert.ok(!template.includes("{{{"), "Unsafe unescaped template interpolation");
assert.equal([...template.matchAll(/type="range"/g)].length, 1, "SoundPad must expose one volume slider");
for (const [, action] of template.matchAll(/data-action="([A-Za-z]+)"/g)) assert.ok(read("scripts/SoundPad.js").includes(`"${action}"`), `Missing UI action: ${action}`);
for (const path of ["README.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", ...files("docs").filter(path => path.endsWith(".md") && !path.startsWith("docs/archive/"))]) {
    for (const [, target] of read(path).matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(https?:|#|mailto:)/.test(target)) continue;
        exactPath(resolve(root, dirname(path), decodeURIComponent(target.split("#")[0])));
    }
}
for (const path of files(".github/workflows").filter(path => /\.ya?ml$/.test(path))) {
    for (const [, ref] of read(path).matchAll(/uses:\s+[^\s@]+@([^\s]+)/g)) {
        assert.match(ref, /^[a-f0-9]{40}$/, "Pin Actions by immutable commit SHA");
    }
}
console.log(`Static checks passed: ${sources.length} runtime modules, ${keys.size} EN/DE keys, imports, docs links, one slider, release acceptance and pinned CI actions.`);
console.log("Template checks are structural. Live acceptance is the owner's reported test, not automated runtime certification.");
