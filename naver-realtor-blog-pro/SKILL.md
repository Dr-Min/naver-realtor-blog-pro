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
   visibility. Click only `임시저장`.
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

Branch on the input:

- **매물번호** (digits, e.g. 2610279820): run
  `node scripts/fetch-listing.mjs --article <no> --out <run-dir> --photos`,
  then read `listing.json` as the fact set. Read
  [references/input-listing.md](references/input-listing.md) first.
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

If image generation fails or is unavailable, print the exact generation prompt
for the user to run elsewhere, note the miss in one line, and continue — images
never block the run.

## Stage 2 — draft

Write `blog-post.md` with the fast skill's chapter order, plus:

- `핵심 조건` as a **2-column markdown table** (`| 항목 | 내용 |`), one verified
  fact per row;
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

The script logs in from the persistent profile (never from credentials), types
the draft block-by-block with the tested editor mechanics, pastes the table,
uploads images one at a time, attaches the map, applies the `tel:` link, runs a
deterministic pre-save check, clicks only `임시저장`, and returns JSON.

Interpret the JSON honestly:

- `SAVED` — report the draft path and that publishing stays with the human.
- `BLOCKED` + `login_required` — tell the user to run
  `node scripts/login-setup.mjs` and log in once; then rerun the transfer.
- `UNVERIFIED` — say the click happened but no reliable signal was seen.
- `FAILED` — read `warnings`/`error`, fix the draft or environment, retry once.
  If the script cannot work at all (e.g. selectors broken by a Naver update),
  fall back to the fast skill's agent-driven transfer so the run still ends,
  and note that `config/selectors.yaml` needs an update.

Finish by returning the absolute draft path, the status, image results, and any
excluded photos or unknown material facts.
