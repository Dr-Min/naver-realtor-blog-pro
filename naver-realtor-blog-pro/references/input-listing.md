# Listing-number input contract

매물번호는 네이버부동산(land.naver.com)의 articleNo다. 매물이 네이버부동산에
등록돼 있을 때만 존재하며, 등록자의 매물 관리 화면과 상세 페이지 URL에서
확인할 수 있다.

## Rules

- Digits-only input (6+ digits) is treated as an articleNo. Run
  `fetch-listing.mjs` and use `listing.json` as the fact set. Facts keep
  `source: naver-land` so the report can say where each fact came from.
- The fetched record is used as-is; never embellish it. A field missing from
  the record stays missing — never fill it from guesses.
- Listing photos: `--photos` saves the article's images. They are appropriate
  when the user is the one who registered the listing (their own photos). When
  the user supplies their own photo files, those take priority.
- If the fetch fails (deleted listing, blocked request, structure change), say
  so in one line, save the raw response for debugging, and fall back to asking
  for the facts in natural language — the run continues.
- No ownership verification is performed by design; the user is responsible
  for using their own listing number.
