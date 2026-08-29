#!/usr/bin/env node
// 네이버부동산 매물번호(articleNo)로 매물 사실과 갤러리 사진 "전체"를 수집한다.
//
//   node scripts/fetch-listing.mjs --article 2645188091 --out <run-dir> [--photos]
//   node scripts/fetch-listing.mjs --url "https://fin.land.naver.com/articles/2645188091" --out <run-dir> --photos
//
// 실측 근거 (2026-08-26, outputs/research-articleno/findings.md):
// - 상세 URL은 https://fin.land.naver.com/articles/{번호}. 매물번호는 상세
//   페이지 '기본 정보' 표 하단에 표시되며 URL 숫자·API articleNumber와 같다.
//   VR 매물은 /tour로 이동하기도 하지만 API 수집에는 영향이 없다.
// - 매물 사실: front-api article/key → article/basicInfo (key가 준
//   realEstateType·tradeType 파라미터 필요).
// - 사진 전수: front-api article/galleryImages 가 원본 URL 전체를 반환한다.
//   화면 DOM은 지연 로딩이라 첫 화면 <img>만 읽으면 대표 1장으로 끝난다 —
//   과거 이 스크립트의 실패 원인. API 실패 시에만 갤러리 썸네일 순회 폴백.
// - 헤드리스는 429 차단 → 반드시 창 있는 브라우저 + 지속 프로필.
// - 없는 번호는 HTTP 404 + "찾을 수 없어요".
// - 지도 공유 URL(fin.land.naver.com/map?...)에는 매물번호가 들어있지 않다.
//   지도 URL이 오면 이 스크립트가 아니라 상세 URL이나 번호를 받아야 한다.
//
// 정직한 카운트가 계약이다: 예상 N → 확보 N → 저장 N + 실패 사유 목록을
// 가공 없이 보고한다. 조용히 건너뛰는 사진은 없다.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {loadPlaywright} from "./lib/deps.mjs";
const {chromium, devices} = await loadPlaywright();

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
let article = String(args.article || "").trim();

if (!article && args.url) {
  const m = String(args.url).match(/fin\.land\.naver\.com\/articles\/(\d{6,})/);
  if (m) article = m[1];
  else if (/fin\.land\.naver\.com\/map/.test(String(args.url))) {
    process.stdout.write(JSON.stringify({
      ok: false,
      error: "map_url_has_no_article_number",
      hint: "지도 공유 URL에는 매물번호가 없습니다(실측). 매물 상세 페이지 URL(fin.land.naver.com/articles/번호)이나 상세 화면 '기본 정보' 표 하단의 매물번호를 받아 오세요."
    }) + "\n");
    process.exit(1);
  }
}
if (!/^\d{6,}$/.test(article)) {
  process.stdout.write(JSON.stringify({ok: false, error: "--article <매물번호> 또는 --url <상세 URL> 이 필요합니다 (번호는 6자리 이상 숫자)"}) + "\n");
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

const finish = async (payload, code) => {
  await ctx.close().catch(() => {});
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(code);
};

try {
  // 1) 상세 페이지 진입 — 404·삭제 매물을 정직하게 판정
  const resp = await page.goto(`https://fin.land.naver.com/articles/${article}`, {waitUntil: "domcontentloaded", timeout: 40000});
  await page.waitForTimeout(4000);
  const status = resp ? resp.status() : null;
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");
  if (status === 404 || /찾을 수 없/.test(bodyText)) {
    await finish({
      ok: false, stage: "page", http_status: status,
      hint: "매물번호가 유효하지 않거나 광고가 종료·삭제된 상태입니다. 번호는 매물 상세 페이지 '기본 정보' 표 하단에서 확인할 수 있습니다."
    }, 1);
  }

  // 2) 페이지 컨텍스트에서 front-api 3종 GET — 쿠키·헤더가 자동으로 실린다.
  // 일시 오류 대비 1회 재시도.
  const apiOnce = async (p) => page.evaluate(async (u) => {
    try {
      const r = await fetch(u, {headers: {accept: "application/json"}});
      return {status: r.status, body: await r.json().catch(() => null)};
    } catch (e) { return {status: 0, body: null, error: String(e)}; }
  }, `https://fin.land.naver.com/front-api/v1/${p}`);
  const api = async (p) => {
    const first = await apiOnce(p);
    if (first.status === 200) return first;
    await page.waitForTimeout(1200);
    return apiOnce(p);
  };

  const key = await api(`article/key?articleNumber=${article}`);
  // 실측: key 응답은 result.type 아래에 realEstateType·tradeType을 둔다
  const realEstateType = key.body?.result?.type?.realEstateType || "";
  const tradeType = key.body?.result?.type?.tradeType || "";
  const basicInfo = await api(`article/basicInfo?articleNumber=${article}&realEstateType=${realEstateType}&tradeType=${tradeType}`);
  const gallery = await api(`article/galleryImages?articleNumber=${article}`);

  const warnings = [];
  const apiNo = String(basicInfo.body?.result?.detailInfo?.articleDetailInfo?.articleNumber || "");
  if (apiNo && apiNo !== article) warnings.push(`basicInfo의 articleNumber(${apiNo})가 요청 번호와 다릅니다`);
  if (key.status !== 200) warnings.push(`article/key HTTP ${key.status}`);
  if (basicInfo.status !== 200) warnings.push(`article/basicInfo HTTP ${basicInfo.status}`);

  // 3) 사진 전수 목록 — API 우선, 실패 시 갤러리 썸네일 순회 폴백 (실측 절차)
  let images = (gallery.body?.result || [])
    .slice()
    .sort((a, b) => (a.sortingOrder ?? 0) - (b.sortingOrder ?? 0))
    .map((r) => ({url: r.imageUrl, id: r.imageId, representative: Boolean(r.isRepresentative)}));
  let imageSource = "galleryImages_api";

  // 교차 검증: 화면의 "이미지 N개 보기" 숫자와 API 개수를 대조한다
  const uiCountMatch = bodyText.match(/이미지\s*(\d+)개\s*보기/);
  const uiCount = uiCountMatch ? Number(uiCountMatch[1]) : null;
  if (uiCount !== null && images.length && uiCount !== images.length) {
    warnings.push(`화면 표기 ${uiCount}장 ≠ API ${images.length}장 — 두 값을 보고에 그대로 남길 것`);
  }

  if (!images.length) {
    warnings.push(`galleryImages HTTP ${gallery.status} — DOM 폴백으로 전환`);
    imageSource = "dom_fallback";
    const seen = new Set();
    // 실측: 원본 URL = 썸네일 URL에서 ?type=m562 파라미터만 뗀 것.
    // 그래서 (a) 네트워크로 흘러가는 원본을 줍고, (b) 썸네일 src에서
    // 파라미터를 떼어 원본을 유도한다 — 클릭 순회는 (a)를 채우는 보조.
    page.on("request", (req) => {
      const u = req.url();
      if (/landthumb-phinf\.pstatic\.net/.test(u) && !/\?type=/.test(u)) seen.add(u);
    });
    await page.getByRole("button", {name: /이미지\s*\d+개\s*보기|사진/}).first().click({timeout: 4000}).catch(() => {});
    await page.waitForTimeout(1200);
    const thumbs = page.locator(".ivx__index-navigator__item--image");
    const n = await thumbs.count();
    for (let i = 0; i < n; i += 1) {
      await thumbs.nth(i).click({timeout: 2000}).catch(() => {});
      await page.waitForTimeout(300);
    }
    const derived = await page.evaluate(() =>
      [...document.querySelectorAll("img")]
        .map((i) => i.currentSrc || i.src)
        .filter((s) => /landthumb-phinf\.pstatic\.net/.test(s))
        .map((s) => s.split("?")[0])
    ).catch(() => []);
    for (const u of derived) seen.add(u);
    images = [...seen].map((u) => ({url: u, id: null, representative: false}));
    if (!images.length) warnings.push("DOM 폴백에서도 사진을 얻지 못했습니다");
    else if (uiCount !== null && images.length !== uiCount) {
      warnings.push(`DOM 폴백 수집 ${images.length}장 ≠ 화면 표기 ${uiCount}장`);
    }
  }

  // 4) 다운로드 — 예상 → 저장 → 실패(사유) 카운트를 숨기지 않는다
  const saved = [];
  const failed = [];
  if (args.photos && images.length) {
    const photoDir = path.join(outDir, "photos");
    fs.mkdirSync(photoDir, {recursive: true});
    for (let i = 0; i < images.length; i += 1) {
      const {url} = images[i];
      try {
        // 페이지 컨텍스트 fetch는 CORS로 막힌다(실측) — 브라우저 컨텍스트의
        // request API로 받는다 (쿠키 승계, CORS 무관)
        const resp = await ctx.request.get(url, {timeout: 20000});
        if (!resp.ok()) throw new Error("HTTP " + resp.status());
        const file = path.join(photoDir, `${String(i + 1).padStart(2, "0")}.jpg`);
        fs.writeFileSync(file, await resp.body());
        saved.push(file);
      } catch (e) {
        failed.push({url: url.slice(0, 120), reason: String(e.message || e).slice(0, 120)});
      }
    }
  }

  // 5) listing.json — 사실과 카운트의 단일 원본
  const listing = {
    schema_version: "3.0",
    source: "naver-land(fin)",
    article_no: article,
    source_url: `https://fin.land.naver.com/articles/${article}`,
    fetched_at: new Date().toISOString(),
    facts: {
      key: key.body?.result ?? null,
      basic_info: basicInfo.body?.result ?? null
    },
    page_text: bodyText.slice(0, 6000),
    gallery: {
      source: imageSource,
      expected: images.length,
      images,
      downloaded: saved.length,
      failed
    },
    note: "facts와 page_text에 있는 사실만 사용한다. 없는 값은 지어내지 않는다."
  };
  const outFile = path.join(outDir, "listing.json");
  fs.writeFileSync(outFile, JSON.stringify(listing, null, 2));

  await finish({
    ok: true,
    listing: outFile,
    article_no: article,
    article_match: apiNo ? apiNo === article : null,
    photos: {expected: images.length, downloaded: saved.length, failed},
    image_source: imageSource,
    warnings
  }, 0);
} catch (error) {
  await finish({ok: false, stage: "error", error: String(error.message).slice(0, 200)}, 1);
}
