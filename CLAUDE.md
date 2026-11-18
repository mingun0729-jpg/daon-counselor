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
| `<style>` | 디자인 토큰(`:root`) · 단계 표시줄/판 레이아웃 · 접근성 툴바/큰 글씨/고대비 테마 · 복지카드 인식 오버레이 · 신청서 4단계 · 신청·접수 가이드 · 인쇄 스타일 |
| `<body>` 헤더 | 로고(눈 달린 ㅍ) · 접근성 툴바(`#btnBigText`, `#btnHighContrast`, `#btnVoice`, `#btnRateSlow`, `#btnRateNormal`, `#btnSpeak`, `#btnStopSpeak`) |
| `.stepbar` (sticky) | 5단계 버튼 `.stepbtn[data-step="1"~"5"]` + 진행 막대 `#stepFill` + `#stepPos`. 클릭하면 `goStep()` |
| `#stepNavTop` / `#stepNavBottom` | `data-nav-step` 이전·다음 버튼 자리 — `renderStepNavs()`가 두 곳을 같은 내용으로 그린다 |
| `#pane-1` 1단계 상담·복지카드 | `.chat`(`#cardStart` → `#chatLog` → `#chips` → `#composer`) + `.side`(예시 `#personas`, 조건 요약 `#sumStrip`, 진행 안내 `#stepGuide`) |
| `#pane-2` 2단계 추천 일자리·근무지 | 소탭 `#tab-jobs`/`#tab-work` + `#panel-jobs`(`#jobsBody`) · `#panel-work`(`#workBody`) |
| `#pane-3` 3단계 서류 준비·자동 수집 | `#docsBody` — 사업 선택(`#programSelect`), 진행률(`#docBar`), 자동 수집(`#docAgent`), 체크리스트(`#docList`). 상단 배지 `#count-docs` |
| `#pane-4` 4단계 신청서 작성 | `#formBody` — 신청서 4단계 마법사(`#formFlow`) + 5항목 초안(`#draftOut`) |
| `#pane-5` 5단계 원클릭 접수·접수처 | `#submitBody` — 자동 접수 CTA(`#btnAutoSubmit`), 가상 접수증, 메일(`#btnAppMail`), 접수처 카드, 접수 가이드(`#applyGuide`) |
| `#ocr` | 복지카드 인식 시연 오버레이(4단계·추출값 확인·개인정보 고지) |
| `#auto` | 원클릭 자동 접수 시연 오버레이(4단계·점검·패키지·전송·가상 접수증). `.ocr` 계열 클래스를 재사용하고 `auto-*`/`ag-*`/`receipt` 스타일을 쓴다 |
| `#fileView` | 서류 파일 미리보기 모달(iframe) |
| `#printArea` | 인쇄용 신청서·가상 접수증 출력 전용 컨테이너(화면에서는 `display:none`) |

한 번에 한 단계(`.pane`)만 보인다. 단계 판은 `hidden` 속성으로 감추고, 각 판 안의 내용은 렌더 함수가 채운다.

### 스크립트 섹션 (IIFE 안, 주석의 번호와 대응)

| 섹션 | 주요 심볼 |
| --- | --- |
| 0. 공통 유틸 | `$`, `$$`, `esc`, `toast` |
| 0-B. 접근성·임시저장 | `a11y` 상태(`big`·`contrast`·`voice`·`rate`), `applyA11y`, `setA11y`, `setRate`, `TTS_RATE_SLOW(0.82)`/`TTS_RATE_NORMAL(0.93)`, `speak`/`speakScreen`/`stopSpeak`(TTS), `screenSummaryText`, `snapshot`(v2), `saveNow`/`scheduleSave`/`restoreSaved`/`clearSaved`, `updateSaveBadge` |
| 1. 조건 라벨 | `SEVERITY_LABEL`, `TYPE_LABEL`, `WORK_LABEL`, `ENV_LABEL` |
| 2. 상태 | `state` — 상담 조건 + `card`(카드 인식 결과) + `form`(신청서 입력) + `formStep` + `ocr` |
| 3. 질문 정의 | `STEPS` (장애 정도 → 유형 → 근무형태 → 근로환경) |
| 4. 판별 규칙 | `ruleGeneralFull` ~ `ruleRemote`, `statusOf`, `PROGRAMS`(8개 사업), `analyze()` |
| 5. 근로지원 제도 | `buildSupports()` (7개 제도) |
| 6. 근무지 예시 | `WORKPLACES`(10곳), `matchWorkplace`, `scoredWorkplaces` |
| 7. 서류 체크리스트 | `COMMON_DOCS`, `EXTRA_DOCS`, `ALWAYS_EXTRA`, `docsFor(pid)` |
| 7-B. 복지카드 인식 | `CARD_SAMPLES`, `OCR_STEPS`, `openOcr`, `setOcrStage`, `renderOcr`, `confirmOcr`, `applyCard`, `handleCardFile`, `renderCardStart` |
| 7-C. 신청서 4단계 | `ORG`(접수처 기관 정보: 기관명·주소·대표전화), `WIZARD_STEPS`, `TRANSPORTS`, `AIDS`, `JOB_OPTIONS`, `wizardHtml`, `step1Html`~`step4Html`, `appSheetHtml`(신청일·수신처·접수처·서류 현황 표·동의·서명란), `guideHtml`(실제 신청·접수 가이드), `todayStr`, `jurisdiction`/`submissionPlace`, `buildAppText`, `buildFormMotivation`, `printApp`, `toggleAid`, `onFieldChange` |
| 7-D. 자동 접수 시연·메일 | `AUTO_STEPS`, `AUTO_FIELDS`, `autoState`, `autoCheck`, `openAuto`/`closeAuto`/`setAutoStage`/`renderAuto`, `issueReceipt`/`receiptInner`/`printReceipt`/`barcodeBars`, `buildMail`/`launchMailto`/`openMailApp` |
| 7-E. 서류 자동 수집 에이전트 | `AGENT_DOC_META`, `MockDocAgentAPI`(`fetchDocument` — 실제 연동 시 `fetch()`로 교체), `fetchDocumentFromAgent`, `AGENT_STATE`, `agentPanelInner`, `renderAgentPanels`, `runDocAgent`/`agentStep` |
| 7-F. 서류 파일 생성·미리보기·저장 | `DOC_STYLE`/`DOC_WM`(문서 공통 서식·워터마크), `DOC_FILE_META`/`DOC_TITLE`, `docFileFor`(HTML/SVG 본문 + 실제 Blob 크기, 입력값 캐시), `form1Doc`~`form3Doc`, `certSpec`/`certDoc`, `svgCardDoc`, `docFileCard`/`docPendingCard`, `fmtBytes`, `buildZip`(무압축 ZIP), `autoPkgStart`/`pkgFinish`, `openFileView`/`closeFileView`/`printDocFile`, `saveDocFile`/`savePackage` |
| 8. 대화 렌더링 | `addMsg`, `renderChat`, `renderChips` |
| 9. 단계 판 렌더링 | `renderSummary`, `renderJobs`, `renderWorkplaces`, `renderDocs`(= `renderDocsPrep` 3단계 + `renderFormStage` 4단계 + `renderSubmitStage` 5단계), `docsCtx`, `needHtml`, `personaButtonsHtml`, `draftBoxHtml`, `orgCardHtml`, `attachFormStage`, `updateDocProgress`, `renderAll` |
| 10. 신청서 초안 | `buildDraft()` (자기소개 5항목 초안), `generateDraft`, `copyText` |
| 11. 직접 입력 해석 | `KEYWORDS`, `parseText`, `applyText` |
| 12. 단계 이동·초기화·예시 | `STEP_META`, `stepIndex`, `docsProgress`, `stepAchieved`, `goStep`, `scrollToStepTop`, `renderStepBar`, `renderStepNavs`, `renderStepGuide`, `renderSubTabs`, `setSubTab`, `setTab`, `focusDashboard`, `resetState`, `resetAll`, `PERSONAS`, `applyPersona` |
| 13. 이벤트 연결 | `init()` — 모든 이벤트 위임은 `#panel-docs`, `#cardStart`, `#personas`에 걸려 있음 |

## 3. 데이터·수치 출처

- 모든 사업 종류·근무시간·보수·서류·선발 기준은 **2026년 장애인일자리 사업안내(보건복지부)** 기준으로 작성했다. 예: 일반형 전일제 주 40시간(12월 37.5시간) 월 2,156,880원(12월 2,022,720원, 세전), 시간제 주 20시간 월 1,078,440원, 복지일자리 참여형 주 14시간 이내 월 577,920원.
- 수치를 바꿀 때는 **출처 연도를 함께 표기**하고, 화면 하단 고지(`.disclaimer`, `.fine`)의 "2026년 장애인일자리 사업안내 기준" 문구도 같이 갱신한다.
- 근무지 10곳과 신청서 예시 값(성명·연락처·거주지 등)은 **가상 예시**다. 실제 기관·개인 정보로 바꾸지 않는다. 다만 **접수처 안내의 기관명·주소·대표전화**는 공개된 공식 정보(**(사)경남지체장애인연합회 진주시지회**, 경남 진주시 대신로 232번길 16, ☎ 055-755-0008)를 실제 값으로 쓰고, 코드의 `ORG` 상수에서 관리한다. 신청인 예시 값은 계속 가상 값만 쓴다.
- 복지카드 인식은 **실제 OCR이 아니다.** 브라우저 안에서 미리 정한 `CARD_SAMPLES` 값을 단계별로 보여 주는 시연용 연출이다. 실제 OCR·서버 전송 기능을 넣는 것처럼 문구를 바꾸지 말 것.
- 자동 접수 시연·가상 접수증·필요서류 자동 수집(`MockDocAgentAPI`)도 **실제 전송·실제 발급이 아니다.** 외부 요청 0건의 모의(Mock) 응답이며, 화면 고지(‘실제 기관으로 전송되지 않습니다’, ‘시연용 모의 API(Mock) 응답입니다’)를 지우지 않는다. 실제 연동은 `MockDocAgentAPI.fetchDocument`를 `fetch()`로 바꾸는 것으로 시작하되, 그때도 개인정보 전송 고지를 같이 바꾼다.
- 메일 보내기는 **빈 수신자 `mailto:`만** 쓴다. 특정 개인·기관 이메일 주소를 코드에 넣지 않는다.

## 4. 수정 시 주의사항

1. **단일 파일 유지** — 외부 CDN·폰트·라이브러리·이미지 파일을 추가하지 않는다(오프라인 시연 가능해야 함). 아이콘은 이모지 또는 인라인 SVG만 사용.
2. **색 대비 4.5:1 이상 유지** — 본문 텍스트는 `--ink`/`--ink-soft`/`--ink-mute`를 쓰고, 잔디색 위 흰 글씨는 `--grass(#25854B)` 이상 진한 색만 사용. 새 색을 넣으면 명도 대비를 확인한다.
3. **터치 영역 44px 이상** — 버튼·칩·입력·체크박스는 `min-height:44px` 규칙을 지킨다(`.btn`, `.chip`, `.cs-btn`, `.wstep`, `.pick`, `.aid`, `.field input` 등).
4. **접근성** — 키보드 포커스(`:focus-visible`), `aria-*`(탭은 `role="tab"`/`aria-selected`, 단계는 `aria-current="step"`), 스크린리더용 `.sr-only`, `prefers-reduced-motion` 대응을 유지한다.
5. **기존 기능 보존** — 8개 일자리 사업·근로지원 제도·10개 근무지·예시 3개·대화형 상담·직접 입력 해석은 시연의 핵심이므로 삭제·축소하지 않는다. 단계별 UI로 옮겨도 기능은 단계 안에서 그대로 살린다(예: 5항목 초안은 4단계, 접수 가이드는 5단계).
6. **프로토타입 고지 유지** — 화면 하단 `공모전 시연용 프로토타입입니다` 문구, 복지카드 화면과 시작 영역의 "사진은 서버로 전송되지 않습니다" 문구, 신청서 미리보기의 "제출 전 실제 양식 확인" 안내를 지우지 않는다.
7. **인쇄** — 신청서·가상 접수증 인쇄는 `#printArea`만 출력된다(`@media print`의 `body > *:not(#printArea)` 규칙). 새 요소를 인쇄에 넣으려면 `#printArea` 안에 생성해야 한다.
8. **XSS 습관** — 사용자 입력은 반드시 `esc()`로 이스케이프한 뒤 `innerHTML`에 넣는다.
9. **접근성 3모드 유지** — 새 UI를 추가하면 `body.a11y-big`(큰 글씨)와 `body.a11y-contrast`(고대비) 대응 스타일을 같은 커밋에 넣는다. 고대비에서 새 색을 쓰면 흰 배경/흰 글씨가 남지 않도록 오버라이드하고, 대비 4.5:1을 확인한다. 인쇄는 고대비 모드에서도 `#printArea`를 흑백으로 강제한다.
10. **서류 파일은 시연용 가상 문서** — 파일 카드·미리보기·저장(`Blob`+`URL.createObjectURL`)·ZIP(`buildZip`)은 모두 브라우저 안에서만 만들어지며 외부 전송이 없다. 문서 본문에는 항상 ‘시연용 가상 문서’ 워터마크와 고지, 가상 값(가명)만 넣고, 실제 발급 효력이 있는 것처럼 쓰지 않는다. ZIP은 무압축(store) 방식이며 파일명은 UTF-8 플래그(0x0800)로 기록한다.
11. **큰 글씨·음성 안내 기준** — 큰 글씨 모드는 본문 22px·말풍선 20px·버튼 56px 이상을 기준으로 하고, 1280px·375px에서 가로 스크롤이 없어야 한다. 음성 대본은 민원인 응대용 구어체로 쓰고 단계 이름을 함께 말한다. 음성은 한국어 우선순위(SunHi→Yuna→Sora→Heami→Google 한국의)로 고르며, 속도는 **기본 `rate 0.82`(천천히)** 이고 헤더의 `천천히(0.82)`/`보통(0.93)` 버튼(`#btnRateSlow`/`#btnRateNormal`)으로 바꿀 수 있다(`a11y.rate`에 저장). `pitch 1.04`는 유지한다. 속도 상수는 `TTS_RATE_SLOW`/`TTS_RATE_NORMAL` 한 곳에서만 관리한다.
12. **localStorage 키 고정** — 접근성 설정 `daon.a11y.v1`(`big`·`contrast`·`voice`·`rate`), 자동 임시저장 `daon.state.v1`(내부 스키마 `v: 2` — `v:1`도 읽는다). 저장값은 브라우저 밖으로 나가지 않으며 `resetAll`/`resetState`(새로 시작)에서 비운다. 저장 스키마를 바꾸면 `v`를 올리고 `restoreSaved`에서 검증한다. 현재 단계(`step` 1~5)와 2단계 소탭(`subtab`)도 저장·복원하며, 단계 이동은 `goStep()`이 `state.step`과 pane 표시·단계 표시줄을 함께 맞춘다. `goStep()` 밖에서 pane을 직접 감추지 않는다.
13. **음성 안내** — 외부 TTS 라이브러리를 넣지 않고 `window.speechSynthesis`만 사용한다. 미지원 브라우저에서는 토스트로 안내하고 기능을 켜진 상태로 두지 않는다.
14. **단계별(위저드) UI 원칙** — ① 상담·복지카드 → ② 추천 일자리·근무지 → ③ 서류 준비·자동 수집 → ④ 신청서 작성 → ⑤ 원클릭 접수·접수처의 5단계를 유지하고, 한 화면에는 한 단계만 보여 준다. 새 기능은 해당 단계의 판(`#pane-N`의 렌더 함수)에 넣고, 이전/다음 버튼(`data-nav-step`, 최소 44px·큰 글씨 56px)과 상단 단계 표시줄(`.stepbtn`)을 함께 갱신한다. 조건이 아직 없을 때 2~5단계는 `needHtml()`로 예시 3개를 안내하며, 단계 이동은 항상 `goStep()`을 거친다(스크롤을 길게 내리지 않아도 처음부터 접수증까지 넘어갈 수 있어야 한다).

## 5. Claude Code 협업 규칙

- **개인정보 절대 커밋 금지** — 실명·주민등록번호·연락처·주소·계좌·복지카드 사진·스크린샷 원본을 저장소에 넣지 않는다. 이 저장소는 **공개(Public)** 이며 GitHub Pages로 누구나 볼 수 있다. 예시 값은 `김다온(가명)`, `010-1234-5678`, `경상남도 진주시 ○○로 12 (예시)` 같은 가상 값만 쓴다.
- **시연용 고지 유지** — 복지카드 인식은 시연 연출임을 화면과 코드 주석 모두에 남긴다.
- 커밋 전 최소 확인:
  1. `index.html` 하나로 열리는지(콘솔 오류 0)
  2. 단계 표시줄로 1→5단계를 오가며 이전/다음 버튼이 동작하는지, 예시 3개 → 2단계 소탭 → 3단계 자동 수집 → 4단계 신청서 마법사 → 5단계 자동 접수·가상 접수증까지 이어지는지
  3. 복지카드 샘플 1·2 → 인식 4단계 → 확인 → 상담·신청서 1단계 자동 입력이 되는지
  4. 모바일 폭(360~420px)에서 가로 스크롤이 없는지(큰 글씨·고대비 포함)
- 배포는 `main` 브랜치에 push하면 GitHub Pages가 자동 반영한다(1분 내외). 반영 후 실제 URL에서 새 기능 문구가 보이는지 확인한다.
- 이 저장소는 공모전 제출·시연용이다. 기능을 늘리기보다 **시연 흐름이 끊기지 않는 것**을 우선한다.
