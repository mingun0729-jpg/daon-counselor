# CLAUDE.md — 다온(DAON) 프로토타입 작업 안내

이 문서는 Claude Code로 이 저장소를 이어서 작업할 때 지켜야 할 구조·기준·규칙을 정리한 것입니다.
사람이 읽어도 되고, AI 코딩 에이전트가 먼저 읽는 문서로도 쓰입니다.

## 1. 프로젝트 개요

- **다온(DAON)** — 장애인 일자리 맞춤형 AI 도우미 **공모전 시연용 웹 프로토타입**.
- **앱(Application)처럼 동작하는 4개 화면**으로 이어진다.
  1. **복지카드** — 사진 업로드(이 시연판은 글자를 판독하지 않는다고 안내) · 예시 인물 7종 · 내 정보 직접 입력(이름·유형·정도) 세 가지 길
  2. **할 수 있는 일자리** — 조건에 따라 신청 가능/확인 필요/지금은 어려움으로 나눈 8개 사업과 진주 지역 근무지 10곳
  3. **서류** — 나라 기관(정부24·국민건강보험공단·복지로·고용24)에 AI가 대신 로그인해 서류를 받아 신청서에 붙이는 과정을 실시간 로그로 보여 줌
  4. **신청** — 복지카드·기관 서류로 채운 정보는 그대로 두고, 빠진 칸(연락처·사는 곳·계좌·하고 싶은 말)만 적어 제출 → 접수번호와 접수증
- 상담(대화형 질문) 단계와 5단계 위저드는 **없다.** 화면마다 큰 버튼 하나로 다음 화면에 간다.
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
| `<style>` | 디자인 토큰(`:root`) · 앱 틀(헤더·편하게 보기·단계 표시·하단 큰 버튼) · 화면별 카드 · 접근성 3모드(큰 글씨·고대비·쉬운 말) · 시트/모달 · 인쇄 |
| `.topbar` | 로고(눈 달린 ㅍ) · `#btnBack` · `#btnStartOver`(처음부터) + 편하게 보기 줄(`#btnBigText`, `#btnHighContrast`, `#btnVoice`, `#a11yRate`의 `#btnRateSlow`/`#btnRateNormal`, `#btnStopSpeak`) |
| `.steps` | 4단계 표시 `button.stp[data-goto="card|jobs|docs|submit"]` — 지나온 단계는 `✓`, 지금 단계는 `aria-current="step"` |
| `main` 안 5개 화면 | `#view-card`(카드 인식) · `#view-jobs` · `#view-docs` · `#view-submit` · `#view-done`. 한 번에 하나만 보이고 나머지는 `hidden` |
| `#view-card` | `#cardHome`(시작: `#btnScan`, `#btnSamples`, `#btnManual`, `#cardFile`) / `#cardDone`(인식 결과 `#cardVisual`, 배려 안내 `#cardHint`, `#btnCardEdit`, `#btnCardAgain`) |
| `#view-jobs` | `#condWho`·`#btnCond`(조건 바꾸기), `#jobList`(라디오 카드), `#btnJobMore`, `#offBox`(지금은 어려운 일자리), `#workList`(근무지), `#supportBox`(근로지원 제도) |
| `#view-docs` | 진행 카드(`#docsTitle`·`#docProgTxt`·`#docBar`), **실시간 진행 로그** `#agentLog`/`#alList`, 기관 카드 `#agencyList`, 파일 카드 `#fileList`, `#selfBox`(직접 준비) |
| `#view-submit` | 자동 채움 안내 `#autoDesc`, 입력 3칸(`#inPhone`, `#inAddr`, `#inBank`+`#inAcct`)과 `#inMotiv`(+`#btnDraft`), `#formDocList` |
| `#view-done` | 접수증 `#doneNo`·`#doneReceipt`, 인쇄 `#btnPrint`, ZIP `#btnZip`, 메일 `#btnMail` |
| `.dock` | 화면마다 **큰 버튼 하나** `#ctaMain` + 안내 `#dockNote`. 카드 화면(인식 전)과 완료 화면에서는 숨긴다 |
| 시트·모달 | `#sheet`(예시 카드·직접 고르기·조건 바꾸기·처음부터), `#ocr`(카드 읽기 4단계), `#login`(기관 로그인 시연), `#submitOv`(제출 4단계), `#fileView`(서류 미리보기 iframe) |
| `#printArea` | 인쇄용 컨테이너(화면에서는 `display:none`) |

### 스크립트 섹션 (IIFE 안, 주석의 번호와 대응)

| 섹션 | 주요 심볼 |
| --- | --- |
| 0. 공통 유틸 | `$`, `$$`, `esc`, `toast` |
| 0-B. 접근성·임시저장 | `a11y`(`big`·`contrast`·`voice`·`rate`), `applyA11y`, `setA11y`, `setRate`, `TTS_RATE_SLOW(0.82)`/`TTS_RATE_NORMAL(0.93)`, `speak`/`stopSpeak`(TTS), `setSpeakUI`, `checkKoreanVoice`, `announce` |
| 1. 이름표 | `TYPE_LABEL`, `TYPE_SHORT`, `SEVERITY_LABEL`, `WORK_LABEL`, `WORK_SHORT`, `ENV_LABEL`, `TRANSPORTS`, `AIDS`/`AIDS_LABEL`, `ORG` |
| 2. 상태 | `state` — `view`·`card`·`type`·`severity`·`workType`·`envs(Set)`·`selectedProgram`·`selectedWorkplace`·`checked`·`fetched`·`form`·`receipt`·`easy` |
| 3. 기관 | `AGENCY`(정부24·건강보험·복지로·고용24·협회), `DOC_AGENCY`, `AGENT_DOC_META`/`agentMeta` |
| 4. 판별 규칙 | `ruleGeneralFull` ~ `ruleRemote`, `statusOf`, `PROGRAMS`(8개), `analyze()` |
| 5. 근로지원 | `buildSupports()`(7개 제도) |
| 6. 근무지 | `WORKPLACES`(10곳), `TAG_LABEL`, `WARN_TAGS`, `matchWorkplace`, `scoredWorkplaces` |
| 7. 서류 목록 | `COMMON_DOCS`, `EXTRA_DOCS`, `ALWAYS_EXTRA`, `docsFor` |
| 5(앱). 복지카드 | `CARD_SAMPLES`(7종), `OCR_STEPS`, `openSamples`/`openSampleConfirm`(예시 인물 확인), `openUploadNotice`(사진 업로드 → 판독 없음 안내), `openManual`, `openOcr`/`finishOcr`, `applyCard`, `applyManual`, `applyProfile`(장애 유형별 배려: 시각=큰글씨+읽어주기, 지적·자폐성=쉬운 말, 정신=근무 시간·업무 조정 안내, 지체·뇌병변=큰 글씨·큰 버튼) |
| 6(앱). 화면 흐름 | `VIEW_ORDER`, `go`, `render`, `renderSteps`, `renderCard`, `renderDock` |
| 7(앱). 일자리 | `analyze` 결과를 `jobCardHtml`로, `kindOfProgram`·`workRows`·`pickDefaultWorkplace`, `renderWork`(진주 근무지), `renderSupports`, `openCond` |
| 8(앱). 서류 | `fetchState`(진행 로그·phase), `requiredFetchDocs`, `assocDocs`, `docsStats`, `agencyGroups`, `renderDocs`, `renderAgentLog`/`pushLog`/`phaseLabel`, `openLogin`/`confirmLogin`, `fetchDocs`(접속→로그인→발급→첨부 단계별 실행) |
| 9(앱). 신청 | `renderSubmit`(확인 카드 `#confirmCard` · 필요 지원 칩 `aidChipsHtml`), `validateForm`(aria-invalid·role=alert), `readForm`, `clearFieldError`, `JOB_DEFAULT`, `buildDraftText`, `submitAll`, `makeReceipt`, `renderDone`, `birthText`/`maskedRrn` |
| 9-B. 포커스 | `focusViewHeading`(화면 전환 → 제목), `focusBack`/`overlayReturn`(모달을 열었던 버튼으로 복원), `selectProgram`/`selectWorkplace`가 재렌더 뒤 선택한 라디오로 포커스 |
| 10(앱). 인쇄·저장 | `printHtmlString`(새 탭 인쇄, 팝업 차단 시 `downloadHtml`), `printApp`, `saveAllZip`, `sendMail`, `allDocs` |
| 11(앱). 읽어주기 | `screenSummaryText`(화면별 대본), `speakScreen` |
| 12(앱). 저장·복원 | `snapshot`(v4), `saveNow`/`scheduleSave`/`restoreSaved`/`clearSaved`, `resetAll` |
| 13~15. 시트·이벤트·시작 | `openSheet`/`closeSheet`, `bindEvents`(이벤트 위임), `init` |
| 7-F. 서류 파일 | `DOC_STYLE`/`DOC_WM`, `DOC_FILE_META`/`DOC_TITLE`, `docFileFor`(HTML/SVG + 실제 Blob 크기), `form1Doc`~`form3Doc`, `certSpec`/`certDoc`, `svgCardDoc`, `docFileCard`/`docPendingCard`, `buildZip`(무압축 ZIP), `openFileView`/`saveDocFile`/`printDocFile` |

## 3. 데이터·수치 출처

- 모든 사업 종류·근무시간·보수·서류·선발 기준은 **2026년 장애인일자리 사업안내(보건복지부)** 기준이다. 예: 일반형 전일제 주 40시간(12월 37.5시간) 월 2,156,880원(12월 2,022,720원, 세전), 시간제 주 20시간 월 1,078,440원, 복지일자리 참여형 주 14시간 이내 월 577,920원.
- 수치를 바꿀 때는 **출처 연도를 함께 표기**하고, 화면 하단 고지의 "2026년 장애인일자리 사업안내 기준" 문구도 같이 갱신한다.
- 근무지 10곳과 신청서 예시 값(성명·연락처·거주지·계좌)은 **가상 예시**다. 실제 기관·개인 정보로 바꾸지 않는다. 다만 **접수처 안내의 기관명·주소·대표전화**는 공개된 공식 정보(**(사)경남지체장애인연합회 진주시지회**, 경남 진주시 대신로 232번길 16, ☎ 055-755-0008)를 실제 값으로 쓰고 `ORG` 상수에서 관리한다.
- 복지카드 인식은 **실제 OCR이 아니다.** 사진을 올리면 `openUploadNotice`가 "사진에서 글자를 자동으로 판독하지 않았습니다"를 먼저 보여 주고 (a) 내 정보 직접 입력 (b) 예시 인물 중 고르게 한다. 업로드 사진은 읽지도, 저장하지도, 서버로 보내지도 않는다. 예시 인물을 고른 경우에는 `openSampleConfirm`에서 본인 정보가 맞는지 확인을 거친 뒤 `openOcr` 연출로 넘어간다. 어떤 경로로도 사진을 근거로 이름·유형을 자동으로 채우지 않는다.
- 기관 로그인·서류 자동 수집·자동 첨부·접수는 **실제 연동이 아니다.** 외부 요청 0건의 모의(Mock) 연출이며, 화면 고지("시연용 가상 로그인", "실제로는 본인이 직접 발급받아야 해요", "실제 기관으로 전송되지 않았습니다")를 지우지 않는다. 실제 연동을 붙일 때는 `fetchDocs`의 단계 실행을 실제 API 호출로 바꾸고, 개인정보 전송 고지를 함께 바꾼다.
- 메일 보내기는 **빈 수신자 `mailto:`만** 쓴다. 특정 개인·기관 이메일 주소를 코드에 넣지 않는다.

## 4. 수정 시 주의사항

1. **단일 파일 유지** — 외부 CDN·폰트·라이브러리·이미지 파일을 추가하지 않는다(오프라인 시연 가능해야 함). 아이콘은 이모지 또는 인라인 SVG만 사용한다.
2. **간편함이 1원칙** — 한 화면에 초록(주된) 버튼은 하나, 나머지는 같은 크기의 흰 버튼이다. 화면마다 "지금 눌러야 할 것"이 분명해야 한다. 새 요소를 넣을 때는 (a) 지금 화면에서 꼭 필요한가 (b) 쉬운 말인가 (c) 손가락으로 누르기 큰가를 먼저 본다. 표·작은 글씨·긴 문단을 쌓지 않는다.
3. **쉬운 말 우선** — 화면 문구는 "복지카드 찍기", "할 수 있는 일자리", "나라에서 서류 가져오기", "빠진 것만 적고 내기"처럼 일상어로 쓴다. 행정 용어가 필요하면 괄호로 짧게 덧붙인다.
4. **색 대비 4.5:1 이상** — 본문은 `--ink`/`--ink-soft`/`--ink-mute`, 초록 버튼은 `--btn(#1B6438)` 위 흰 글씨를 쓴다.
5. **터치 영역 44px 이상** — 기본 버튼 `.btn` 56px, 하단 `.cta` 62px, 큰 글씨 모드에서는 64~72px. 칩·입력·저장 버튼도 44px 이상.
6. **접근성** — 키보드 포커스(`:focus-visible`), `aria-*`(누른 상태 `aria-pressed`, 단계 `aria-current="step"`, 진행 로그 `aria-live`), `.sr-only`, `prefers-reduced-motion` 대응을 유지한다. 고정 헤더가 입력칸을 가리지 않도록 `scroll-margin-top`을 유지한다.
7. **접근성 3모드** — `body.a11y-big`(큰 글씨), `body.a11y-contrast`(고대비), `body.easy`(지적·자폐성 인식 시 쉬운 말 모드). 새 UI를 추가하면 세 모드의 스타일을 같은 커밋에 넣는다.
8. **장애 유형별 배려** — `applyProfile()`이 카드 인식 뒤 자동으로 맞춘다. 시각=큰 글씨+읽어주기, 청각=글자 안내, 지체·뇌병변=큰 글씨·큰 버튼, 지적·자폐성=쉬운 말 모드, 정신=근무 시간·업무 조정 안내. **지적·자폐성·정신을 하나로 묶거나 정신장애를 '발달장애'로 표시하지 않는다**(`TYPE_ORDER`, `isDevType`). 이 동작을 없애거나 문구를 바꾸지 않는다.
9. **기존 기능 보존** — 8개 사업·근로지원 제도 7개·근무지 10곳·예시 인물 7종·서류 파일 생성·미리보기·저장·ZIP·인쇄·메일·읽어주기는 시연의 핵심이므로 삭제·축소하지 않는다.
10. **프로토타입 고지 유지** — 신청서·서류의 "시연용 가상 문서" 워터마크, 카드 화면의 "사진은 서버로 보내지 않아요", 접수 완료의 "실제로 전송되지 않은 시연용 접수" 문구를 지우지 않는다.
11. **인쇄** — 신청서 인쇄는 `printHtmlString()`이 문서를 새 탭(Blob URL)으로 열어 인쇄하고, 팝업이 막히면 HTML 파일로 저장한다. 인쇄용 문서는 `docShell()`(7-F)이 만든 완성 HTML이어야 한다.
12. **XSS 습관** — 사용자 입력은 반드시 `esc()`로 이스케이프한 뒤 `innerHTML`에 넣는다.
13. **서류 파일은 시연용 가상 문서** — 파일 카드·미리보기·저장(`Blob`+`URL.createObjectURL`)·ZIP(`buildZip`)은 브라우저 안에서만 만들어지며 외부 전송이 없다. 문서 본문에는 항상 '시연용 가상 문서' 워터마크와 고지, 가상 값(가명)만 넣는다. ZIP은 무압축(store) 방식이며 파일명은 UTF-8 플래그(0x0800)로 기록한다.
14. **큰 글씨·음성 안내 기준** — 큰 글씨 모드는 본문 20px 이상·버튼 64px 이상, 375px에서 가로 스크롤이 없어야 한다. 음성 대본은 민원인 응대용 구어체로 쓰고 화면 이름을 함께 말한다. 음성은 한국어 우선순위(SunHi→Yuna→Sora→Heami→Google 한국의)로 고르며, 속도는 **기본 `rate 0.82`(천천히)**, `0.93`(보통)으로 바꿀 수 있다. `pitch 1.04` 유지. 속도 상수는 `TTS_RATE_SLOW`/`TTS_RATE_NORMAL` 한 곳에서만 관리한다.
15. **localStorage 키 고정** — 접근성 설정 `daon.a11y.v1`(`big`·`contrast`·`voice`·`rate`), 자동 임시저장 `daon.state.v1`(내부 스키마 `v: 4` — 화면 `view`·카드·조건·선택한 사업·근무지·서류 상태·신청서 입력·접수증). 저장값은 브라우저 밖으로 나가지 않으며 `resetAll`에서 비운다. 스키마를 바꾸면 `v`를 올리고 `restoreSaved`에서 검증한다.
16. **음성 안내** — 외부 TTS 라이브러리를 넣지 않고 `window.speechSynthesis`만 사용한다. 한국어 음성이 없는 기기에서는 음성 안내를 켜지 않고 `NO_KO_VOICE_MSG`로 안내한다.
17. **단계 표시와 화면 이동** — 화면 이동은 항상 `go(view)`를 거쳐 `state.view`·화면 표시·단계 표시·하단 버튼을 함께 맞춘다. 화면을 직접 감추지 않는다. `go()`는 새 화면 제목(`h1`/`h2`)으로 포커스를 옮기고, 목록을 다시 그리는 함수는 재렌더 뒤 선택한 라디오로 포커스를 돌려준다(`focusBack`). 모달은 `overlayReturn`으로 열었던 버튼에 포커스를 돌린다.
18. **입력 오류 연결** — 필수 입력은 `required`(aria-required)·`aria-describedby`(오류 span)·`aria-invalid`·오류 문구 `role="alert"`를 함께 쓴다. `validateForm`은 필드 안 모든 입력의 `aria-invalid`를 같이 맞춘다. 새 입력칸을 추가하면 label·오류 문구·연결을 같은 커밋에 넣는다.
19. **4단계 확인 카드** — `#view-submit` 맨 위 `#confirmCard`에서 이름·생년월일·주소·필요 지원·이동 수단을 확인·수정하게 하고, 값은 `state.form`에 저장되어 `form1Doc`~`form3Doc`·인쇄·ZIP·접수증·미리보기에 그대로 들어간다. 이름·생년월일을 가짜로 만들지 않는다(`birthText()`는 입력값만 쓰고 비어 있으면 `—`).
18. **진행 로그** — 기관 서류 수집은 `fetchState.log`에 쌓고 `renderAgentLog()`가 최신 순으로 그린다. 단계는 `connect → login → issue → attach`이며, 새 단계를 넣으면 `phaseLabel()`과 기관 카드 상태 문구를 함께 고친다.

## 5. Claude Code 협업 규칙

- **개인정보 절대 커밋 금지** — 실명·주민등록번호·연락처·주소·계좌·복지카드 사진·스크린샷 원본을 저장소에 넣지 않는다. 이 저장소는 **공개(Public)** 이며 GitHub Pages로 누구나 볼 수 있다. 예시 값은 `김다온(가명)`, `010-1234-5678`, `경상남도 진주시 ○○로 12 (예시)` 같은 가상 값만 쓴다.
- **시연용 고지 유지** — 복지카드 인식·기관 로그인·서류 자동 첨부·접수는 시연 연출임을 화면과 코드 주석 모두에 남긴다.
- 커밋 전 최소 확인:
  1. `index.html` 하나로 열리는지(콘솔 오류 0)
  2. 예시 카드 → 인식 → 일자리 → 서류(기관 로그인 모달·진행 로그·파일 카드) → 신청 → 접수증까지 이어지는지
  3. 되돌아가기(이전 화면·단계 표시·처음부터)가 동작하는지
  4. 모바일 폭(360~420px)에서 가로 스크롤이 없는지(큰 글씨·고대비·쉬운 말 모드 포함)
- 배포는 `main` 브랜치에 push하면 GitHub Pages가 자동 반영한다(1분 내외). 반영 후 실제 URL에서 새 기능 문구가 보이는지 확인한다.
- 이 저장소는 공모전 제출·시연용이다. 기능을 늘리기보다 **시연 흐름이 끊기지 않는 것**을 우선한다.
