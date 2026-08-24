# Script transfer contract

`post-draft.mjs` is deterministic code. It does exactly what the tested agent
mechanics did, but in seconds and without tokens:

1. Login check from the persistent profile only (`NID_AUT` cookie). No
   credential is ever read, asked, or stored; `login-setup.mjs` opens a window
   for the human to log in once (로그인 상태 유지 + 2단계 인증 생략 권장,
   지속은 약 2주이며 영구가 아니다).
2. Editor entry via PostWriteForm URL. The autosave dialog is declined with
   `취소` and the run continues — 취소 does not delete; the old draft stays in
   the 임시저장 list.
3. Title, then left alignment (the title's centering is inherited otherwise).
4. **One single paste for the whole body.** Every paragraph, heading, blank
   line, and table is built as one HTML string (explicit `font-size:15px`
   paragraph spans, `font-size:19px;font-weight:700` headings, inline-styled
   tables) and delivered through the real clipboard (`ClipboardItem` with
   text/html) plus a real paste keystroke — a synthetic paste event looks
   successful while the editor silently ignores it (measured). The paste is
   never split: **a second paste after a component insertion corrupts the
   document at save time** — every paragraph after the last heading of the
   second paste turns fully bold and the tel line vanishes (measured,
   reproduced, bisected). The script verifies the expected table count after
   the paste; on failure the rows are typed as text lines.
5. Photos and the map ride inside that single paste as placeholder paragraphs
   (`@@IMG:n@@`, `@@MAP:n@@`). After the paste, the script clicks each
   placeholder, clears the line, and inserts the component at that caret —
   the component lands exactly at the placeholder position (measured).
   Photos upload one at a time through the file chooser, `개별사진` chosen in
   the layout dialog; captions go into the image caption box, best-effort.
   Map failures are noted and the run continues. A leftover placeholder is
   reported honestly in `pre_save_check.placeholder_leftover`.
6. The phone line is typed after the paste and linked as `tel:` through the
   link layer. With the single-paste flow the link survives save and reload
   (measured) — the earlier "normalizer strips tel:" observation was a
   side effect of the two-paste corruption. The script still re-checks
   `[data-href^="tel:"]` before saving and reports the truth in
   `pre_save_check.tel_link_attached`; the number always remains as visible
   text and the CTA banner carries it too.
7. A deterministic pre-save check (image/table/map counts, body completeness,
   placeholder sweep, no publish dialog), then click only `저장`(임시저장).
   The publish button is never targeted by any selector in this script.
8. Success requires a real signal: the saved toast or a draft-count change.
    Otherwise the result is UNVERIFIED, honestly.

All UI selectors live in `config/selectors.yaml`. When Naver changes the
editor, update that file only. While it is broken, the fast skill's
agent-driven transfer remains the fallback path.
