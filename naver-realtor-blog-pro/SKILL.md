---
name: naver-realtor-blog-pro
description: "Use when a Korean realtor wants a Naver Blog listing post produced end-to-end with the least typing: accept either a Naver 부동산 매물번호(articleNo) or natural-language facts, generate a thumbnail and a phone-CTA banner, write a table-formatted mobile/PC-readable draft, and save it as a Naver draft through a deterministic script transfer. Trigger on ‘매물번호 XXXX로 블로그 글 올려줘’, ‘이 매물 블로그 글 만들어서 임시저장까지’, or any fast-skill request that also asks for 썸네일/전화 배너/표. No keyword research or reports; see naver-realtor-blog for that."
---

# Naver realtor blog pro

The fast skill's frame with three slots filled in: listing-number input,
generated images (thumbnail + phone CTA), and a script transfer that moves the
locked draft into the Naver editor in seconds with zero tokens. Announce a
one-line progress note at each stage.

## Core contract — inherited from the frame, verified by check-core.mjs

1. **Fact integrity.** The user's statements and the fetched listing record are
   the only fact sources. Never invent price, fees, area, floor, options,
   move-in dates, visits, demand, or search volume. Omit unknown facts or mark
   them 확인 필요; never guess. Web-fetched facts keep their source in the run.
2. **Permission boundary.** Never ask for an ID, password, verification code,
   cookie, or session file, and never store one — login happens once, by the
   human, inside the transfer browser via `scripts/login-setup.mjs`. Work only in surfaces this
   run created, never a tab the user opened. Never publish, schedule, or change
   visibility. Click only `임시저장`. **Never click any 삭제 button anywhere
   in the blog UI** — 임시저장 목록의 "전체 삭제"는 "선택 삭제"보다 먼저
   놓여 있어 패턴 매칭 클릭 한 번이 저장글 전부를 지운다 (실사고, 휴지통
   없음). Draft cleanup is the human's job, always. Never auto-accept a
   browser confirm dialog either — dismiss is the only allowed response.
3. **Single source.** The validated local draft is the only source the transfer
   script reads. Never rewrite content during transfer; fix the file,
   revalidate, rerun.
4. **Machine-checked format.** Run `scripts/validate-draft.mjs` before transfer;
   the transfer itself is deterministic code (`scripts/post-draft.mjs`), not
   model judgment.
5. **Honest ending.** Report exactly one of `SAVED`, `BLOCKED`, `UNVERIFIED`,
   `FAILED`, taken from the script's JSON. Never claim success without a real
   confirmation signal, and always preserve the local draft when a later step
   fails.
6. **Uninterrupted cycle.** Run start to finish without pausing to ask. Stop
   only for a login the user alone can complete or a missing material fact.
   A failed thumbnail, CTA, map, or one photo is noted in one line and the run
   continues. Never end a run waiting for an answer the run could decide.

## Stage 0 — profile and input branch

Read the shared profile first (`scripts/profile.mjs`; office name, realtor
name, phone, prohibited claims). Missing profile never blocks a run.

When the user supplies office facts the profile lacks (사무소명, 중개사명,
상담 전화), **edit `~/.codex/naver-realtor-blog/profile.yaml` now** and fill
those fields, so later runs stop asking. Say so in one line. Do not touch
fields this skill does not use.

**When BOTH the profile and the user's message lack the office facts, ask —
do not silently skip.** A listing post exists to make the phone ring; the
contact path is a material fact (measured: the first live run shipped a
draft with no contact anywhere). Fold it into the **single consolidated
Stage 0 question**, before any long work starts: 사무소명·중개사 성함·상담
전화 (+ any missing material listing facts) in one message, with a note
that answering once means never being asked again. If the user says 없이
해줘, proceed and note the omission in one line. Never pause for this again
mid-run.

Branch on the input:

- **매물번호** (digits, e.g. 2645188091): run
  `node scripts/fetch-listing.mjs --article <no> --out <run-dir> --photos`,
  then read `listing.json` as the fact set. The script collects **every
  gallery photo** via the galleryImages API (measured), not just the cover
  image — read the output's `photos: {expected, downloaded, failed}` counts
  and report them as-is; a shortfall is never silently dropped. Read
  [references/input-listing.md](references/input-listing.md) first.
  네이버 매물번호는 보통 10자리다 — 6자리 미만이면 네이버 번호가 아니므로
  묻지 말고 자연어 경로로 넘어가라 (다른 매물 사이트의 자체 번호일 수
  있다 — 실측: 돼지부동산.com의 5자리 item 번호). 네이버 지도 공유
  URL(`fin.land.naver.com/map?...`)에는 매물번호가 없다(실측) — 상세 페이지
  URL이나 '기본 정보' 표 하단의 매물번호를 한 번만 요청하라.
- **매물 페이지 URL** (네이버가 아닌 사이트 포함): 그 페이지를 열어
  게시된 사실과 사진만 수집해 자연어 경로로 처리한다. 페이지에 없는 값은
  지어내지 않는다 — 사실 무결성 규칙 그대로.
- **Natural language**: intake exactly as the fast skill does — parse
  everything supplied, one consolidated follow-up at most.

Create the run folder with `scripts/init-run.mjs` either way.

## Stage 1 — images

Read [references/content-format.md](references/content-format.md) for exact
specs. Use the Codex `$imagen` skill:

- **Thumbnail** (every post): 1:1, listing name + office/realtor name from the
  profile as visible text. Save to `<run-dir>/thumbnail.png`.
- **CTA banner** (once, reused): if
  `~/.codex/naver-realtor-blog/assets/cta-banner.png` is missing, generate it
  with the office phone number rendered large, and save it there. Later runs
  reuse the file.

**Copy the images the draft will use into the run folder** (`thumbnail.png`,
`cta-banner.png`) and reference them with those exact relative names. Before
writing an image line into the draft, check the file actually exists; a
reference to a file that was never generated is a silent lie the transfer
script can only skip. If generation fails, omit that image line, print the
exact generation prompt for the user, note the miss in one line, and continue —
images never block the run, and the tel: text line still carries the phone
number without the banner.

## Stage 2 — draft

**Settle the photos before writing a word.** If the user gave per-photo
labels, use them — the owner knows their property best. If photos arrived
without labels, **look at them yourself**: open each image file with the
image-viewing tool, and write one line per photo (which space + what is
visible, e.g. `07.jpg — 내부: 층고 높은 철골 홀, 팔레트 보관`) into
`<run-dir>/photo-labels.md` before drafting. A photo you cannot confidently
place gets a conservative label (`내부 공간`) and the draft never asserts
more than the label says — fact integrity applies to what you see, too.
These labels are the input that decides the chapters and photo placement
below; never write the draft first and guess photo positions after.

**Default: use every photo the user handed over.** A folder given without
instructions means "put these in the post" — listing posts earn trust with
photos. Similar photos of the same space run **consecutively** after the
sentence that describes that space (four exterior shots → four image lines
in a row in the exterior chapter). Drop a photo only when it is effectively
the same shot again or unusably blurred, and **report every exclusion with
its reason**. Select a subset only when the user asked for it ("골라 써줘",
"대표만"). If photo policy is genuinely ambiguous, fold one line into the
single consolidated Stage 0 question — never a separate pause.

Write `blog-post.md` on the fixed skeleton — 도입 → *(서술 챕터들)* → 위치 →
핵심 조건 → 상담 안내 → 태그 — where the 2–4 서술 챕터 in the middle are
**chosen to fit the listing**, not copied from a template. The photo space
labels and the property type decide them: a 화장실 photo earns its chapter, a
listing without a 현관 never gets one. See
[references/content-format.md](references/content-format.md) for per-type
starting sets. `핵심 조건` stays directly above `상담 안내`.

Voice: read `style.preset` from the shared profile (담백형 기본, 친근형·정보형
지원 — same presets as the naver-realtor-blog skill). Then:

- `핵심 조건` as a **2-column markdown table** (`| 항목 | 내용 |`), one verified
  fact per row;
- inline emphasis where it earns its place: `**bold**` for at most one key fact
  per chapter, `==highlight==` for at most two phrases in the whole post; no
  font colors by default;
- thumbnail as the first image line, photos after the sentences that describe
  the same space, CTA banner image as the last image line before tags;
- `위치` chapter with `지도: <매물 주소 또는 건물명>` (unit number dropped).

Then run `node scripts/validate-draft.mjs --file <run-dir>/blog-post.md`.
If validation fails, fix once and rerun.

## Stage 3 — script transfer

Read [references/transfer-contract.md](references/transfer-contract.md), then:

```bash
node scripts/post-draft.mjs --file <run-dir>/blog-post.md --blog <blogId> --tel <public phone>
```

`--tel` is not optional when the profile has `office.public_contact` — the
phone line and its tel: link come only from this flag, never from the draft
body. Omitting it ships a listing post with no contact path (measured).

The script logs in from the persistent profile (never from credentials), pastes
the whole body as one real-clipboard HTML paste (splitting the paste corrupts
formatting — measured), inserts photos and the map at placeholder positions,
applies the `tel:` link, runs a deterministic pre-save check, clicks only
`임시저장`, and returns JSON.

Interpret the JSON honestly:

- `SAVED` — report the draft path and that publishing stays with the human.
- `BLOCKED` + `login_required` — **run `node scripts/login-setup.mjs`
  yourself**: it opens a browser window and waits (≤5 min) for the human to
  log in. Tell the user in one line that the window is open and to log in
  there (`로그인 상태 유지` 체크). The script exits on its own once login is
  detected, restarts the same browser profile once, and returns `LOGGED_IN`
  only when the login survives that restart. Never ask for or handle any
  credential. If it returns `SESSION_NOT_PERSISTED`, reopen it and tell the
  human to check `로그인 상태 유지`; otherwise rerun the transfer. The user
  should not need to type any command.
- `UNVERIFIED` — say the click happened but no reliable signal was seen.
- `FAILED` — follow the retry protocol below, in this order, before ending:
  1. If the browser died at launch (log shows `Crashpad … Permission denied`
     or the script never reached the editor), that is a sandbox permission
     problem, not a draft problem. **Re-run the exact same headed command and
     request execution approval** — an approved headed run works (measured).
  2. **Never add `--headless`, under any circumstances.** The transfer is a
     real-clipboard paste that breaks without a focused window, and Naver
     blocks headless browsers (measured 429). A headless "success" would be
     a false one.
  3. If the approved headed retry also fails, paste the script's JSON output
     **and the full stderr, verbatim and unedited**, into your report, keep
     the local draft untouched, and end with `FAILED`. Do not summarize the
     error in your own words instead of quoting it.
  4. Only if the script itself is broken (e.g. selectors dead after a Naver
     update): fall back to the fast skill's agent-driven transfer so the run
     still ends, and note that `config/selectors.yaml` needs an update.

Finish by returning the absolute draft path, the status, image results, and any
excluded photos or unknown material facts. Always include the script's draft
count evidence (`draft_count_before` → `after`) — that pair is the only proof
the save was real. If the 임시저장 list already holds a draft with the same
title (re-runs do this), say so and tell the user how to pick the new one:
newest saved time, and in this skill's posts the one whose ending carries the
CTA banner and the linked 전화 상담 line.
