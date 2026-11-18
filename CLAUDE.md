# CLAUDE.md — 다온(DAON) 프로토타입 작업 안내

이 문서는 Claude Code로 이 저장소를 이어서 작업할 때 지켜야 할 구조·기준·규칙을 정리한 것입니다.
사람이 읽어도 되고, AI 코딩 에이전트가 먼저 읽는 문서로도 쓰입니다.

## 1. 프로젝트 개요

- **다온(DAON)** — 장애인 일자리 맞춤형 AI 카운셀러 **공모전 시연용 웹 프로토타입**.
- 장애 당사자가 몇 번의 선택만으로 ① 신청 가능한 일자리 사업·지원제도 판별, ② 근로환경에 맞는 근무지 예시, ③ 사업별 구비서류, ④ 신청서 작성까지 한 화면에서 끝내는 흐름을 보여 준다.
- **복지카드(장애인등록증) 촬영·업로드 → OCR 인식 → 자격 판별 → 세부 신청서 작성** 흐름이 대표 시연 시나리오다.
- 서버·빌드·패키지 없음. `index.html` **단일 파일**(HTML + CSS + JS, 외부 CDN·라이브러리 0개)이며, 파일을 열면 바로 동작한다.
- 배포: GitHub Pages — https://mingun0729-jpg.github.io/daon-counselor/
- 출발점: 진주시지체장애인협회 일자리 업무 현장 경험(작성자 본인 근로 경험).

## 2. 파일 구조

```
index.html    # 프로토타입 전체 (이 파일 하나가 배포본)
README.md     # 기능·시연 방법 안내
CLAUDE.md     # 이 문서 (작업 규칙)
.nojekyll     # GitHub Pages Jekyll 처리 비활성화
```

로컬 원본은 별도 작업 공간의 `prototypes/disability-job-counselor.html`이며, 배포 전에는 항상 이 원본과 `index.html`을 동일하게 맞춘다(MD5 비교).

### `index.html` 내부 구성

| 위치 | 내용 |
| --- | --- |
| `<style>` (약 10~915행) | 디자인 토큰(`:root`) · 레이아웃 · 접근성 툴바/큰 글씨/고대비 테마 · 복지카드 인식 오버레이 · 신청서 4단계 · 신청·접수 가이드 · 인쇄 스타일 |
| `<body>` 헤더 | 로고(눈 달린 ㅍ) · 접근성 툴바(`#btnBigText`, `#btnHighContrast`, `#btnVoice`, `#btnSpeak`, `#btnStopSpeak`) · 예시 3개(`#personas`) |
| 대화 패널 `.chat` | 복지카드 시작 영역 `#cardStart` → `#chatLog` → `#chips` → `#composer` |
| 대시보드 `.dashboard` | `#sumStrip` 요약 + 탭 3개(`#tab-jobs`, `#tab-work`, `#tab-docs`)과 패널 3개 |
| `#ocr` | 복지카드 인식 시연 오버레이(4단계·추출값 확인·개인정보 고지) |
| `#printArea` | 인쇄용 신청서 출력 전용 컨테이너(화면에서는 `display:none`) |

### 스크립트 섹션 (IIFE 안, 주석의 번호와 대응)

| 섹션 | 주요 심볼 |
| --- | --- |
| 0. 공통 유틸 | `$`, `$$`, `esc`, `toast` |
| 0-B. 접근성·임시저장 | `a11y` 상태, `applyA11y`, `setA11y`, `speak`/`speakScreen`/`stopSpeak`(TTS), `screenSummaryText`, `snapshot`, `saveNow`/`scheduleSave`/`restoreSaved`/`clearSaved`, `updateSaveBadge` |
| 1. 조건 라벨 | `SEVERITY_LABEL`, `TYPE_LABEL`, `WORK_LABEL`, `ENV_LABEL` |
| 2. 상태 | `state` — 상담 조건 + `card`(카드 인식 결과) + `form`(신청서 입력) + `formStep` + `ocr` |
| 3. 질문 정의 | `STEPS` (장애 정도 → 유형 → 근무형태 → 근로환경) |
| 4. 판별 규칙 | `ruleGeneralFull` ~ `ruleRemote`, `statusOf`, `PROGRAMS`(8개 사업), `analyze()` |
| 5. 근로지원 제도 | `buildSupports()` (7개 제도) |
| 6. 근무지 예시 | `WORKPLACES`(10곳), `matchWorkplace`, `scoredWorkplaces` |
| 7. 서류 체크리스트 | `COMMON_DOCS`, `EXTRA_DOCS`, `ALWAYS_EXTRA`, `docsFor(pid)` |
| 7-B. 복지카드 인식 | `CARD_SAMPLES`, `OCR_STEPS`, `openOcr`, `setOcrStage`, `renderOcr`, `confirmOcr`, `applyCard`, `handleCardFile`, `renderCardStart` |
| 7-C. 신청서 4단계 | `ORG`(접수처 기관 정보: 기관명·주소·대표전화), `WIZARD_STEPS`, `TRANSPORTS`, `AIDS`, `JOB_OPTIONS`, `wizardHtml`, `step1Html`~`step4Html`, `appSheetHtml`(신청일·수신처·접수처·서류 현황 표·동의·서명란), `guideHtml`(실제 신청·접수 가이드), `todayStr`, `jurisdiction`/`submissionPlace`, `buildAppText`, `buildFormMotivation`, `printApp`, `toggleAid`, `onFieldChange` |
| 8. 대화 렌더링 | `addMsg`, `renderChat`, `renderChips` |
| 9. 대시보드 렌더링 | `renderSummary`, `renderJobs`, `renderWorkplaces`, `renderDocs` |
| 10. 신청서 초안 | `buildDraft()` (자기소개 5항목 초안), `generateDraft`, `copyText` |
| 11. 직접 입력 해석 | `KEYWORDS`, `parseText`, `applyText` |
| 12. 탭·초기화·예시 | `setTab`, `resetAll`, `PERSONAS`, `applyPersona` |
| 13. 이벤트 연결 | `init()` — 모든 이벤트 위임은 `#panel-docs`, `#cardStart`, `#personas`에 걸려 있음 |

## 3. 데이터·수치 출처

- 모든 사업 종류·근무시간·보수·서류·선발 기준은 **2026년 장애인일자리 사업안내(보건복지부)** 기준으로 작성했다. 예: 일반형 전일제 주 40시간(12월 37.5시간) 월 2,156,880원(12월 2,022,720원, 세전), 시간제 주 20시간 월 1,078,440원, 복지일자리 참여형 주 14시간 이내 월 577,920원.
- 수치를 바꿀 때는 **출처 연도를 함께 표기**하고, 화면 하단 고지(`.disclaimer`, `.fine`)의 "2026년 장애인일자리 사업안내 기준" 문구도 같이 갱신한다.
- 근무지 10곳과 신청서 예시 값(성명·연락처·거주지 등)은 **가상 예시**다. 실제 기관·개인 정보로 바꾸지 않는다. 다만 **접수처 안내의 기관명·주소·대표전화**는 공개된 공식 정보(**(사)경남지체장애인연합회 진주시지회**, 경남 진주시 대신로 232번길 16, ☎ 055-755-0008)를 실제 값으로 쓰고, 코드의 `ORG` 상수에서 관리한다. 신청인 예시 값은 계속 가상 값만 쓴다.
- 복지카드 인식은 **실제 OCR이 아니다.** 브라우저 안에서 미리 정한 `CARD_SAMPLES` 값을 단계별로 보여 주는 시연용 연출이다. 실제 OCR·서버 전송 기능을 넣는 것처럼 문구를 바꾸지 말 것.

## 4. 수정 시 주의사항

1. **단일 파일 유지** — 외부 CDN·폰트·라이브러리·이미지 파일을 추가하지 않는다(오프라인 시연 가능해야 함). 아이콘은 이모지 또는 인라인 SVG만 사용.
2. **색 대비 4.5:1 이상 유지** — 본문 텍스트는 `--ink`/`--ink-soft`/`--ink-mute`를 쓰고, 잔디색 위 흰 글씨는 `--grass(#25854B)` 이상 진한 색만 사용. 새 색을 넣으면 명도 대비를 확인한다.
3. **터치 영역 44px 이상** — 버튼·칩·입력·체크박스는 `min-height:44px` 규칙을 지킨다(`.btn`, `.chip`, `.cs-btn`, `.wstep`, `.pick`, `.aid`, `.field input` 등).
4. **접근성** — 키보드 포커스(`:focus-visible`), `aria-*`(탭은 `role="tab"`/`aria-selected`, 단계는 `aria-current="step"`), 스크린리더용 `.sr-only`, `prefers-reduced-motion` 대응을 유지한다.
5. **기존 기능 보존** — 8개 일자리 사업·7개 지원제도·10개 근무지·예시 3개·대화형 상담·직접 입력 해석은 시연의 핵심이므로 삭제·축소하지 않는다.
6. **프로토타입 고지 유지** — 화면 하단 `공모전 시연용 프로토타입입니다` 문구, 복지카드 화면과 시작 영역의 "사진은 서버로 전송되지 않습니다" 문구, 신청서 미리보기의 "제출 전 실제 양식 확인" 안내를 지우지 않는다.
7. **인쇄** — 신청서 인쇄는 `#printArea`만 출력된다(`@media print`의 `body > *:not(#printArea)` 규칙). 새 요소를 인쇄에 넣으려면 `#printArea` 안에 생성해야 한다.
8. **XSS 습관** — 사용자 입력은 반드시 `esc()`로 이스케이프한 뒤 `innerHTML`에 넣는다.
9. **접근성 3모드 유지** — 새 UI를 추가하면 `body.a11y-big`(큰 글씨)와 `body.a11y-contrast`(고대비) 대응 스타일을 같은 커밋에 넣는다. 고대비에서 새 색을 쓰면 흰 배경/흰 글씨가 남지 않도록 오버라이드하고, 대비 4.5:1을 확인한다. 인쇄는 고대비 모드에서도 `#printArea`를 흑백으로 강제한다.
10. **localStorage 키 고정** — 접근성 설정 `daon.a11y.v1`, 자동 임시저장 `daon.state.v1`. 저장값은 브라우저 밖으로 나가지 않으며 `resetAll`/`resetState`(새로 시작)에서 비운다. 저장 스키마를 바꾸면 `v`를 올리고 `restoreSaved`에서 검증한다.
11. **음성 안내** — 외부 TTS 라이브러리를 넣지 않고 `window.speechSynthesis`만 사용한다. 미지원 브라우저에서는 토스트로 안내하고 기능을 켜진 상태로 두지 않는다.

## 5. Claude Code 협업 규칙

- **개인정보 절대 커밋 금지** — 실명·주민등록번호·연락처·주소·계좌·복지카드 사진·스크린샷 원본을 저장소에 넣지 않는다. 이 저장소는 **공개(Public)** 이며 GitHub Pages로 누구나 볼 수 있다. 예시 값은 `김다온(가명)`, `010-1234-5678`, `경상남도 진주시 ○○로 12 (예시)` 같은 가상 값만 쓴다.
- **시연용 고지 유지** — 복지카드 인식은 시연 연출임을 화면과 코드 주석 모두에 남긴다.
- 커밋 전 최소 확인:
  1. `index.html` 하나로 열리는지(콘솔 오류 0)
  2. 예시 3개 → 탭 3개 전환 → 서류 체크 → 신청서 4단계 → 미리보기/복사/인쇄가 모두 동작하는지
  3. 복지카드 샘플 1·2 → 인식 4단계 → 확인 → 상담·신청서 1단계 자동 입력이 되는지
  4. 모바일 폭(360~420px)에서 가로 스크롤이 없는지
- 배포는 `main` 브랜치에 push하면 GitHub Pages가 자동 반영한다(1분 내외). 반영 후 실제 URL에서 새 기능 문구가 보이는지 확인한다.
- 이 저장소는 공모전 제출·시연용이다. 기능을 늘리기보다 **시연 흐름이 끊기지 않는 것**을 우선한다.
