#!/usr/bin/env node
// 네이버부동산 매물번호(articleNo)로 매물 상세를 수집해 listing.json으로 저장한다.
//
//   node scripts/fetch-listing.mjs --article 2610279820 --out <run-dir>
//   node scripts/fetch-listing.mjs --article 2610279820 --out <run-dir> --photos
//
// 토큰을 쓰지 않는 결정론적 수집이다. 실패하면 어디서 막혔는지 JSON으로 알린다.

import fs from "node:fs";
import path from "node:path";

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

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function get(url, referer) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "*/*",
      "Accept-Language": "ko-KR,ko;q=0.9",
      ...(referer ? {Referer: referer} : {})
    }
  });
  return res;
}

const args = argsOf(process.argv.slice(2));
const article = String(args.article || "").trim();
if (!/^\d{6,}$/.test(article)) {
  process.stdout.write(JSON.stringify({ok: false, error: "--article must be a Naver land articleNo (digits)"}) + "\n");
  process.exit(1);
}
const outDir = path.resolve(String(args.out || "."));
fs.mkdirSync(outDir, {recursive: true});

// 모바일 매물 상세 페이지에는 초기 상태 JSON이 인라인으로 들어 있다.
const pageUrl = `https://m.land.naver.com/article/info/${article}`;

function pickJson(html) {
  // 알려진 임베드 지점들을 순서대로 시도한다. 네이버가 구조를 바꾸면 여기에 후보를 추가한다.
  const candidates = [
    /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?})\s*<\/script>/,
    /"articleDetail"\s*:\s*({[\s\S]*?"articleNo"[\s\S]*?})\s*,\s*"articleAddition/,
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  ];
  for (const re of candidates) {
    const m = html.match(re);
    if (!m) continue;
    try { return JSON.parse(m[1]); } catch { /* 다음 후보 */ }
  }
  return null;
}

function walk(obj, wanted, found = {}) {
  if (!obj || typeof obj !== "object") return found;
  for (const [k, v] of Object.entries(obj)) {
    if (wanted.has(k) && (typeof v === "string" || typeof v === "number") && found[k] === undefined) found[k] = v;
    if (typeof v === "object") walk(v, wanted, found);
  }
  return found;
}

const WANTED = new Set([
  "articleNo", "articleName", "aptName", "buildingName", "divisionName",
  "tradeTypeName", "realEstateTypeName", "dealOrWarrantPrc", "rentPrc",
  "dealPrice", "warrantPrice", "rentPrice", "priceString",
  "area1", "area2", "supplySpace", "exclusiveSpace", "exclusiveArea", "supplyArea",
  "floorInfo", "correspondingFloorCount", "totalFloorCount", "direction",
  "moveInTypeName", "moveInPossibleYmd", "monthlyManagementCost", "articleFeatureDesc",
  "detailDescription", "parkingCount", "parkingPossibleYN", "elevatorCount",
  "roomCount", "bathroomCount", "householdCount", "useApproveYmd",
  "exposureAddress", "address", "roadAddress", "jibunAddress", "detailAddress",
  "cityName", "divisionName", "sectionName", "etcAddress",
  "latitude", "longitude", "realtorName", "representativeName", "representativeTelNo",
  "cpName", "articleConfirmYmd", "aptHouseholdCount", "tagList"
]);

function collectImages(obj, list = []) {
  if (!obj || typeof obj !== "object") return list;
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && /landthumb|land\.naver.*(jpg|jpeg|png)|article.*(jpg|jpeg|png)/i.test(v) && v.startsWith("http")) list.push(v);
    if (typeof v === "object") collectImages(v, list);
  }
  return [...new Set(list)];
}

try {
  const res = await get(pageUrl, "https://m.land.naver.com/");
  const html = await res.text();
  if (res.status !== 200) {
    process.stdout.write(JSON.stringify({ok: false, stage: "page", status: res.status, url: pageUrl}) + "\n");
    process.exit(1);
  }
  const state = pickJson(html);
  if (!state) {
    // 페이지는 왔지만 임베드 JSON을 못 찾음 — 원문 일부를 남겨 원인 파악을 돕는다.
    fs.writeFileSync(path.join(outDir, `raw_${article}.html`), html);
    process.stdout.write(JSON.stringify({
      ok: false, stage: "parse", hint: "embedded JSON not found; raw html saved",
      raw: path.join(outDir, `raw_${article}.html`)
    }) + "\n");
    process.exit(1);
  }

  const facts = walk(state, WANTED);
  const images = collectImages(state);
  const listing = {
    schema_version: "1.0",
    source: "naver-land",
    article_no: article,
    source_url: pageUrl,
    fetched_at: new Date().toISOString(),
    facts,
    image_urls: images,
    note: "facts는 네이버부동산 등록 정보 그대로다. 등록자가 곧 사용자 본인일 때 쓰는 것을 전제로 한다."
  };
  const outFile = path.join(outDir, "listing.json");
  fs.writeFileSync(outFile, JSON.stringify(listing, null, 2));

  const saved = [];
  if (args.photos && images.length > 0) {
    const photoDir = path.join(outDir, "photos");
    fs.mkdirSync(photoDir, {recursive: true});
    let i = 0;
    for (const url of images.slice(0, 10)) {
      i += 1;
      try {
        const r = await get(url, pageUrl);
        if (r.status === 200) {
          const ext = (url.match(/\.(jpe?g|png|webp)/i) || [, "jpg"])[1];
          const file = path.join(photoDir, `${String(i).padStart(2, "0")}-listing.${ext}`);
          fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
          saved.push(file);
        }
      } catch { /* 사진 하나 실패는 전체를 막지 않는다 */ }
    }
  }

  process.stdout.write(JSON.stringify({
    ok: true, listing: outFile, fact_count: Object.keys(facts).length,
    image_count: images.length, photos_saved: saved.length
  }, null, 2) + "\n");
} catch (error) {
  process.stdout.write(JSON.stringify({ok: false, stage: "network", error: String(error.message)}) + "\n");
  process.exit(1);
}
