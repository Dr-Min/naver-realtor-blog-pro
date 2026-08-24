import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const skillRoot = path.join(root, "naver-realtor-blog-pro");

test("required bundle files exist", () => {
  for (const rel of [
    "SKILL.md", "references/input-listing.md", "references/content-format.md",
    "references/transfer-contract.md", "config/selectors.yaml",
    "scripts/profile.mjs", "scripts/init-run.mjs", "scripts/fetch-listing.mjs",
    "scripts/validate-draft.mjs", "scripts/login-setup.mjs",
    "scripts/post-draft.mjs", "scripts/check-core.mjs"
  ]) assert.ok(fs.existsSync(path.join(skillRoot, rel)), rel);
});

test("core contract survives in the pro skill", () => {
  const out = execFileSync(process.execPath,
    [path.join(skillRoot, "scripts/check-core.mjs"), "--dir", skillRoot], {encoding: "utf8"});
  assert.match(out, /코어 통과/);
});

test("validator accepts a table draft and the parser sees every block type", async () => {
  const md = [
    "# 표 검증", "", "도입 문장입니다.", "", "## 핵심 조건", "",
    "| 항목 | 내용 |", "|---|---|", "| 보증금 | 1,000만 원 |", "",
    "## 위치", "", "지도: 뚝섬역", "", "#태그"
  ].join("\n");
  const tmp = path.join(root, "outputs", "test-draft.md");
  fs.mkdirSync(path.dirname(tmp), {recursive: true});
  fs.writeFileSync(tmp, md);
  const out = JSON.parse(execFileSync(process.execPath,
    [path.join(skillRoot, "scripts/validate-draft.mjs"), "--file", tmp], {encoding: "utf8"}));
  assert.equal(out.ok, true);
});

test("transfer script never targets the publish button", () => {
  const code = fs.readFileSync(path.join(skillRoot, "scripts/post-draft.mjs"), "utf8");
  assert.doesNotMatch(code, /name:\s*["']발행/);
  assert.match(code, /save_button_name/);
  assert.match(code, /UNVERIFIED/);
  assert.match(code, /login-setup\.mjs/);
  // 자격증명을 다루는 코드가 없어야 한다
  assert.doesNotMatch(code, /password|비밀번호를 입력/i);
});
