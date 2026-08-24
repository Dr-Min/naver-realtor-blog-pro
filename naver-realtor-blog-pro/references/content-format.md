# Content format — pro additions on the fast frame

Chapter order is the fast skill's (도입 → 공간과 옵션 → 현관과 이동 →
비용과 확인 사항 → 위치 → 핵심 조건 → 상담 안내 → 태그) with these changes:

## 핵심 조건 = 2-column table

| 항목 | 내용 |
|---|---|
| 보증금 | 3,000만 원 |

One verified fact per row. Price, rent, fee(+포함/별도), area, floor,
move-in date, parking, elevator, pets. A fact the user did not give does not
get a row. Tables scan better on PC and survive mobile at 2 columns; the
script pastes them as real editor tables, which agent typing cannot afford.

## Images

- `![썸네일 설명](thumbnail.png)` — first image line, right after the intro.
  Thumbnail text: listing name + office/realtor name. 1:1 ratio.
- Space photos follow the sentence describing the same space (fast rule).
- `![전화 상담 배너](<assets>/cta-banner.png)` — last image before tags.
  The banner shows the phone number in large text, so the CTA works even if
  the tel: link is stripped at publish time.
- 공용 자산 폴더(`~/.codex/naver-realtor-blog/assets/`)에 쓸 수 없으면
  배너를 run 폴더에 저장하고 그 경로를 쓴다. 막혔다고 배너를 포기하지 않는다.

## 본문이 하지 말아야 할 것 (실측 실패 사례에서 나온 규칙)

- **전화번호를 본문에 쓰지 않는다.** 전화 상담 줄과 tel: 링크는 전송
  스크립트가 `--tel`로 붙인다. 본문에 또 쓰면 저장본에 번호가 두 번 나온다
  (실측). 상담 안내 챕터는 "연락 주시면 …" 같은 문장으로 끝내고 번호는 빼라.
- **태그에 소제목을 달지 않는다.** `## 태그` 금지. 태그는 문서 마지막에
  해시태그 한 줄(`#파주창고매매 #상지석동창고 …`)로만 쓴다.
- 원고에 없는 파일을 이미지로 참조하지 않는다 (Stage 1 규칙과 동일).

## Voice and restraint

Everything else follows the fast skill: one complete sentence per paragraph,
substantive sentences (PC-first readability), one divider rhythm via chapter
headings, no decorative emoji, no unverifiable claims. A table is for specs;
prose is for the walk-through. Do not convert prose chapters into tables.

## Adaptive 서술 챕터 (2026-08-24 개정)

골격(도입·위치·핵심 조건·상담 안내·태그)은 불변이고, 가운데 서술 챕터는
매물에 맞게 2~4개를 만든다. 사진의 공간 라벨이 챕터를 만든다 — 사진과
사실이 실제로 있는 공간만 챕터가 된다. 유형별 출발 세트:

| 유형 | 서술 챕터 예시 |
|---|---|
| 원룸·투룸·아파트·오피스텔·빌라 | 공간과 옵션 / 이동·주차 (현관·엘리베이터가 있을 때만) / 비용과 확인 사항 |
| 상가·점포 | 내부 구성 / 건물과 유동 / 임대 조건 |
| 사무실 | 사무 공간 / 건물·공용부 / 임대 조건 |
| 토지·단독·타운하우스 | 대지와 건물 / 진입로와 주변 / 조건과 확인 사항 |

없는 공간의 챕터를 만들지 않는 것이 규칙의 전부다. "현관과 이동"은 현관
사진이나 관련 사실이 있을 때만 존재한다.

## Inline emphasis

- `**텍스트**` → 굵게. 챕터당 최대 1곳, 가격·입주일급 사실에만.
- `==텍스트==` → 형광 하이라이트(연노랑). 글 전체 1~2곳.
- 글자색은 기본 사용하지 않는다. 남발은 조사에서 확인된 과장 글의 공통
  신호다. 검증기가 초과를 경고한다.
