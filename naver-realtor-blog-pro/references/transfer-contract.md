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
6. The phone line is typed and tel:-linked **right after the paste, before any
   component insertion** — the text-link layer and the image-link layer are
   the same layer, and once it has been used for an image it consumes a
   selected text line instead of linking it (measured; the line literally
   vanishes). Hard-won rules, all measured:
   - Click only `button[data-name="text-link"]`. A name-based fallback like
     /링크 입력/ also matches the image-link button ("링크 입력 열기").
   - Wait ~0.9s after Shift+Home for the property toolbar, and ~1.2s after
     apply for the binding. **Press no key between apply and the check** —
     an early End/Enter cancels the pending link binding.
   - Verify with a node count that excludes image components; report the
     truth in `pre_save_check.tel_link_attached`. If the line vanished during
     the attempt, retype it as plain text (number visible > number linked).
   With this sequence the link survives save and reload — the earlier
   "normalizer strips tel:" observation was a side effect of the two-paste
   corruption.
   The CTA banner image also gets the same `tel:` link through the image
   property toolbar (`data-name="image-link"`, applied during component
   insertion) — measured: the layer accepts the tel: scheme and the link
   survives save and reload, so a tap on the banner dials the number after
   publish. Reported in `pre_save_check.cta_tel_link_attached`.
7. A deterministic pre-save check (image/table/map counts, body completeness,
   placeholder sweep, no publish dialog), then click only `저장`(임시저장).
   The publish button is never targeted by any selector in this script.
8. Success requires a real signal: the saved toast or a draft-count change.
    Otherwise the result is UNVERIFIED, honestly.

Never run this script with `--headless`. The single paste needs a real
focused window for the clipboard keystroke, and Naver blocks headless
browsers (measured 429 on fin.land, silent breakage risk in the editor).
The flag exists only for debugging by a human who accepts a broken result.

All UI selectors live in `config/selectors.yaml`. When Naver changes the
editor, update that file only. While it is broken, the fast skill's
agent-driven transfer remains the fallback path.
