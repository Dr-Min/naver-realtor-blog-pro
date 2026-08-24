#!/usr/bin/env node
// 네이버부동산 매물번호(articleNo)로 매물 상세를 수집해 listing.json으로 저장한다.
//
//   node scripts/fetch-listing.mjs --article 2610279820 --out <run-dir> [--photos]
//
// 2026-08 현재 네이버부동산은 fin.land.naver.com으로 통합됐고, 데이터 API는
// 헤드리스 브라우저를 차단한다(실측: 헤드리스=429, 헤드=200). 그래서 이 수집기는
// post-draft와 같은 지속 프로필의 실창 브라우저로 상세 페이지를 열어 렌더된
// 데이터를 읽는다. 토큰은 쓰지 않는다. 로그인 계정에 네이버파이낸셜 약관 동의가
// 되어 있어야 한다 (중개사 계정은 보통 이미 동의 상태).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {chromium, devices} from "playwright";

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i += 1; }
  }
  return out;
}

const args = argsOf(process.argv.slice(2));
const article = String(args.article || "").trim();
if (!/^\d{6,}$/.test(article)) {
  process.stdout.write(JSON.stringify({ok: false, error: "--article must be a Naver land articleNo (digits)"}) + "\n");
  process.exit(1);
}
const outDir = path.resolve(String(args.out || "."));
fs.mkdirSync(outDir, {recursive: true});
const PROFILE = path.join(os.homedir(), ".codex", "naver-realtor-blog", "browser-profile");

const iphone = devices["iPhone 14"];
const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false, ...iphone,
  args: ["--disable-blink-features=AutomationControlled"]
});
const page = ctx.pages()[0] || await ctx.newPage();

// 상세 데이터가 실려 오는 API 응답을 그대로 가로챈다 — 파싱이 가장 정확한 지점
const apiPayloads = [];
page.on("response", async (res) => {
  const u = res.url();
  if (/front-api/.test(u) && res.status() === 200 && new RegExp(article).test(u)) {
    try { apiPayloads.push({url: u, body: await res.json()}); } catch { /* json 아님 */ }
  }
});

// 미해결 실측(2026-08-24): 홈에 노출되는 VR 매물의 articleNo는
// /articles/{no}와 /article/{no} 모두 404였고 /articles/{no}/tour만 열렸다.
// 일반 매물의 상세 라우트가 다를 수 있다 — 유효한 중개사 매물번호로
// 재실측해 후보 URL을 갱신할 것. 그때까지 실패 시 자연어 경로가 폴백이다.
const candidates = [
  `https://fin.land.naver.com/articles/${article}`,
  `https://fin.land.naver.com/article/${article}`
];
let landed = null;
try {
  for (const url of candidates) {
    await page.goto(url, {waitUntil: "domcontentloaded", timeout: 40000});
    await page.waitForTimeout(6000);
    const cur = page.url();
    const body = await page.evaluate(() => document.body.innerText).catch(() => "");
    // 실측: fin.land 404 문구는 "찾을 수 없어요" — 축약형으로 두 표기를 모두 잡는다
    if (!/404|agreement/.test(cur) && !/찾을 수 없/.test(body)) { landed = {url: cur, body}; break; }
  }

  if (!landed) {
    await ctx.close();
    process.stdout.write(JSON.stringify({
      ok: false, stage: "page",
      hint: "매물 상세를 열 수 없습니다. 번호가 만료됐거나(광고 종료) 계정에 네이버파이낸셜 약관 동의가 안 된 상태일 수 있습니다."
    }) + "\n");
    process.exit(1);
  }

  // NEXT_DATA(SSR 상태)도 보조 소스로 확보
  const nextData = await page.evaluate(() => {
    const el = document.querySelector("#__NEXT_DATA__");
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  });

  const imageUrls = await page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .map((i) => i.src)
      .filter((s) => /landthumb|land\.phinf|estate/.test(s) && s.startsWith("http"))
  );

  const listing = {
    schema_version: "2.0",
    source: "naver-land(fin)",
    article_no: article,
    source_url: landed.url,
    fetched_at: new Date().toISOString(),
    page_text: landed.body.slice(0, 6000),
    api_payloads: apiPayloads.map((p) => ({url: p.url.slice(0, 120), body: p.body})).slice(0, 6),
    next_data_present: Boolean(nextData),
    image_urls: [...new Set(imageUrls)].slice(0, 12),
    note: "page_text와 api_payloads의 사실만 사용한다. 없는 값은 지어내지 않는다."
  };
  if (nextData) {
    try { fs.writeFileSync(path.join(outDir, "next-data.json"), JSON.stringify(nextData).slice(0, 2_000_000)); } catch { /* optional */ }
  }
  const outFile = path.join(outDir, "listing.json");
  fs.writeFileSync(outFile, JSON.stringify(listing, null, 2));

  const saved = [];
  if (args.photos) {
    const photoDir = path.join(outDir, "photos");
    fs.mkdirSync(photoDir, {recursive: true});
    let i = 0;
    for (const url of listing.image_urls.slice(0, 10)) {
      i += 1;
      try {
        const buf = await page.evaluate(async (u) => {
          const r = await fetch(u); const b = await r.arrayBuffer();
          return Array.from(new Uint8Array(b));
        }, url);
        const file = path.join(photoDir, `${String(i).padStart(2, "0")}-listing.jpg`);
        fs.writeFileSync(file, Buffer.from(buf));
        saved.push(file);
      } catch { /* 한 장 실패는 계속 */ }
    }
  }

  await ctx.close();
  process.stdout.write(JSON.stringify({
    ok: true, listing: outFile, api_payloads: apiPayloads.length,
    text_chars: landed.body.length, image_count: listing.image_urls.length, photos_saved: saved.length
  }, null, 2) + "\n");
} catch (error) {
  await ctx.close().catch(() => {});
  process.stdout.write(JSON.stringify({ok: false, stage: "error", error: String(error.message).slice(0, 200)}) + "\n");
  process.exit(1);
}
