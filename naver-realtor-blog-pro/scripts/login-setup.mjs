#!/usr/bin/env node
// 최초 1회 로그인 설정. 전송 전용 지속 프로필로 브라우저 창을 열고,
// 사람이 직접 네이버에 로그인할 때까지 기다린다.
//
//   node scripts/login-setup.mjs
//
// 아이디·비밀번호·쿠키를 이 스크립트가 받거나 저장하지 않는다.
// 로그인 세션은 브라우저 프로필 폴더에만 남는다 (코중사 방식과 반대).
// 로그인 시 `로그인 상태 유지`와, 제안이 뜨면 `이 브라우저에서 2단계 인증 생략`을
// 사람이 직접 체크하면 약 2주간 재로그인이 필요 없다.

import os from "node:os";
import path from "node:path";
import {chromium} from "playwright";

const PROFILE = path.join(os.homedir(), ".codex", "naver-realtor-blog", "browser-profile");
const TIMEOUT_MS = 5 * 60 * 1000;

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: {width: 1280, height: 900},
  args: ["--disable-blink-features=AutomationControlled"]
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto("https://nid.naver.com/nidlogin.login", {waitUntil: "domcontentloaded"});

process.stderr.write("브라우저 창에서 네이버에 로그인해 주세요 (로그인 상태 유지 체크 권장). 최대 5분 대기...\n");

const started = Date.now();
let ok = false;
while (Date.now() - started < TIMEOUT_MS) {
  const cookies = await ctx.cookies("https://naver.com");
  if (cookies.some((c) => c.name === "NID_AUT")) { ok = true; break; }
  await page.waitForTimeout(2000);
}

process.stdout.write(JSON.stringify({
  ok,
  profile: PROFILE,
  status: ok ? "LOGGED_IN" : "TIMEOUT",
  hint: ok
    ? "로그인 세션이 프로필에 저장됐습니다. 이제 post-draft.mjs가 재로그인 없이 동작합니다."
    : "5분 안에 로그인이 확인되지 않았습니다. 다시 실행해 주세요."
}, null, 2) + "\n");
await ctx.close();
process.exit(ok ? 0 : 1);
