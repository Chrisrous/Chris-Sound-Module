import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = path => readFileSync(resolve(root, path), "utf8");
function files(directory) {
    return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
        const path = `${directory}/${entry.name}`;
        return entry.isDirectory() ? files(path) : [path];
    });
}
const documents = ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md",
    ...files("docs").filter(path => path.endsWith(".md"))];

test("project documentation uses feature-focused language", () => {
    const paths = [...documents, ...files(".github").filter(path => /\.(md|json|ya?ml)$/.test(path)),
        "lang/de.json", "lang/en.json", "tools/check.mjs"];
    for (const path of paths) {
        const text = read(path);
        assert.doesNotMatch(text, /\b(?:owner|assistant|ChatGPT)\b/i, path);
        assert.doesNotMatch(text, /\b(?:the user|der Nutzer)\s+(?:reported|requested|confirmed|approved|hat berichtet)/i, path);
        assert.doesNotMatch(text, /(?:authorized publication|approved publication|für die Veröffentlichung freigegeben)/i, path);
    }
});

test("current and historical documentation links resolve", () => {
    for (const path of documents) {
        for (const [, target] of read(path).matchAll(/\]\(([^)]+)\)/g)) {
            if (/^(https?:|#|mailto:)/.test(target)) continue;
            const local = resolve(root, dirname(path), decodeURIComponent(target.split("#")[0]));
            assert.ok(existsSync(local), `${path}: ${target}`);
        }
    }
});

test("release configuration retains operational gates without narrative fields", () => {
    const config = JSON.parse(read(".github/release-approval.json"));
    assert.equal(config.approved, true);
    assert.equal(config.approval_basis, undefined);
    assert.equal(Object.keys(config.runtime_sha256).length, 14);
});

test("release-description maintenance changes only text", () => {
    const workflow = read(".github/workflows/release-notes.yml");
    assert.match(workflow, /branches: \[maintenance\/project-texts\]/);
    assert.match(workflow, /needs: validate/);
    assert.match(workflow, /json\.dumps\(\{'body': body\}\)/);
    assert.match(workflow, /identity\(after\) != identity\(before\)/);
    assert.match(workflow, /api\(tag_endpoint\)\['object'\] != tag_before\['object'\]/);
    assert.doesNotMatch(workflow, /gh release (?:create|upload|delete)|--clobber|git push|--force/);
    assert.doesNotMatch(read(".github/workflows/test.yml"), /contents: write/);
});
