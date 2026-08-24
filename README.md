# Naver Realtor Blog Pro

[fast 뼈대](https://github.com/Dr-Min/naver-realtor-blog-fast)의 다섯 자리 중
세 자리를 갈아끼운 확장판입니다.

| 자리 | fast | pro |
|---|---|---|
| 입력 | 자연어 매물 사실 | **매물번호(articleNo) 또는 자연어** |
| 이미지 | 사용자 제공 사진 | + **썸네일·전화 CTA 배너 생성** |
| 전송 | 에이전트 브라우저 조작 | **Playwright 스크립트 (수 초, 토큰 0)** |

코어 계약 6가지(사실 무결성·권한 경계·단일 원본·기계 검증·정직한 종료·무중단
완주)는 그대로이며 `scripts/check-core.mjs`가 검사합니다.

## 로그인 — 딱 한 번

```bash
node naver-realtor-blog-pro/scripts/login-setup.mjs
```

열리는 창에서 직접 로그인합니다 (`로그인 상태 유지` 체크). 아이디·비밀번호를
스크립트가 받거나 저장하지 않습니다 — 세션은 브라우저 프로필에만 남고,
이후 실행은 재로그인이 없습니다.

매물번호 수집을 쓰려면 같은 계정이 네이버부동산(네이버파이낸셜) 약관에
동의돼 있어야 합니다. 중개사 계정이라면 이미 동의돼 있는 게 보통입니다.

## 실행

Codex에서 `$naver-realtor-blog-pro`를 부르고 매물번호나 매물 정보를 말하면
끝입니다. 전송 결과는 스크립트가 JSON으로 판정합니다
(`SAVED / UNVERIFIED / BLOCKED / FAILED`). 발행 버튼은 어떤 경로로도
누르지 않습니다.

네이버 에디터 UI가 바뀌면 `config/selectors.yaml`만 고치면 되고, 고치는 동안엔
fast의 에이전트 전송이 폴백으로 동작합니다.
