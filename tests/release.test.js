import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = name => readFileSync(new URL(name, root), "utf8");
const manifest = JSON.parse(read("module.json"));
const stable = /^\d+\.\d+\.\d+$/.test(manifest.version);
const options = { skip: !stable };

function inventory(directory) {
    return readdirSync(new URL(`${directory}/`, root), { withFileTypes: true }).flatMap(entry => {
        const path = `${directory}/${entry.name}`;
        return entry.isDirectory() ? inventory(path) : [path];
    });
}

test("stable release metadata uses the original module identity and matching version", options, () => {
    assert.equal(manifest.id, "chris-sound-module");
    assert.equal(manifest.version, JSON.parse(read("package.json")).version);
    assert.equal(manifest.compatibility.minimum, "14");
    assert.equal(manifest.compatibility.maximum, "14");
    assert.equal(manifest.manifest, "https://raw.githubusercontent.com/Chrisrous/Chris-Sound-Module/main/module.json");
    assert.equal(manifest.download, `https://github.com/Chrisrous/Chris-Sound-Module/releases/download/v${manifest.version}/chris-sound-module.zip`);
});

test("stable compatibility matches the release configuration", options, () => {
    const approval = JSON.parse(read(".github/release-approval.json"));
    assert.equal(approval.approved, true);
    assert.equal(approval.version, manifest.version);
    assert.equal(approval.approved_by, "Chrisrous");
    assert.equal(manifest.compatibility.verified, approval.exact_foundry_build ?? approval.foundry_generation);
    assert.match(approval.tested_commit, /^[a-f0-9]{40}$/);
});

test("stable runtime inventory exactly matches the release baseline", options, () => {
    const expected = JSON.parse(read(".github/release-approval.json")).runtime_sha256;
    const actual = ["scripts", "templates", "css", "lang"].flatMap(inventory).sort();
    assert.deepEqual(actual, Object.keys(expected).sort());
    for (const path of actual) {
        assert.equal(createHash("sha256").update(readFileSync(new URL(path, root))).digest("hex"), expected[path], path);
    }
});

test("publication is branch-scoped and separate from read-only validation", options, () => {
    const workflow = read(".github/workflows/release.yml");
    assert.match(workflow, /branches: \[release\/2\.0\.0\]/);
    assert.match(workflow, /needs: validate/);
    assert.doesNotMatch(workflow, /pull_request:/);
    assert.doesNotMatch(read(".github/workflows/test.yml"), /contents: write/);
    assert.match(workflow, /git diff --exit-code 34063940bf4a3468693c453d071af1cddfbdfdbd HEAD -- scripts templates css lang/);
});

test("publication verifies draft assets before publishing and anonymous downloads afterwards", options, () => {
    const workflow = read(".github/workflows/release.yml");
    assert.ok(workflow.indexOf("Verify uploaded draft assets") < workflow.indexOf("Publish the verified release"));
    assert.ok(workflow.indexOf("Publish the verified release") < workflow.indexOf("Verify public downloads without authentication"));
    assert.match(workflow, /cmp dist\/chris-sound-module.zip verified-draft\/chris-sound-module.zip/);
    assert.match(workflow, /sha256sum --check SHA256SUMS/);
    assert.match(read("docs/RELEASE_NOTES_2.0.0.md"), /2\.0\.0/);
});
