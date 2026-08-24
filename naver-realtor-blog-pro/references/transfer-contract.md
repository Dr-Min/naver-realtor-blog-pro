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
3. Title, then left alignment (the title's centering is inherited otherwise),
   then block-by-block typing with a blank block between paragraphs. Bulk
   injection collapses line breaks (measured), so it is never used.
4. Headings get the real `문단 서식 변경 → 소제목` style, best-effort.
5. Tables go through the real clipboard (`ClipboardItem` with text/html) and
   a real paste keystroke, then the script verifies a table component actually
   appeared — dispatching a synthetic paste event looks successful while the
   editor silently ignores it (measured). On failure the rows are typed as
   text lines.
6. Photos upload one at a time through the file chooser, `개별사진` chosen in
   the layout dialog; captions go into the image caption box.
7. The map is attached with the 장소 tool using the draft's `지도:` anchor;
   any failure is noted and the run continues.
8. The phone line attempts a `tel:` link through the link layer. Measured
   behavior: the editor accepts it at apply time but its normalizer may strip
   the tel: scheme moments later, so the script re-checks `[data-href^="tel:"]`
   before saving and reports the truth in `pre_save_check.tel_link_attached`.
   The phone number always remains as visible text, and the CTA banner image
   carries the number too, so the contact path survives either way.
9. A deterministic pre-save check (image count, body completeness, no publish
   dialog), then click only `저장`(임시저장). The publish button is never
   targeted by any selector in this script.
10. Success requires a real signal: the saved toast or a draft-count change.
    Otherwise the result is UNVERIFIED, honestly.

All UI selectors live in `config/selectors.yaml`. When Naver changes the
editor, update that file only. While it is broken, the fast skill's
agent-driven transfer remains the fallback path.
