# CLAUDE.md — 다온(DAON) 프로토타입 작업 안내

이 문서는 Claude Code로 이 저장소를 이어서 작업할 때 지켜야 할 구조·기준·규칙을 정리한 것입니다.
사람이 읽어도 되고, AI 코딩 에이전트가 먼저 읽는 문서로도 쓰입니다.

## 1. 프로젝트 개요

- **다온(DAON)** — 장애인 일자리 맞춤형 AI 도우미 **공모전 시연용 웹 프로토타입**.
- **앱(Application)처럼 동작하는 4개 화면**으로 이어진다.
  1. **복지카드·주민등록증** — 사진 업로드 시 **브라우저 로컬 OCR**(Tesseract.js `kor+eng`)로 성명·생년월일·(주민등록증이면 주소까지)·장애유형·정도·등록일·발급기관을 실제 판독해 확인 화면에 채움. 복지카드가 없으면 `주민등록증 찍기·올리기`로 시작할 수 있고, **그 사진이 3단계 '신분증 사본' 파일(원본 JPG/PNG)로 그대로 들어간다** · 예시 인물 7종 · 내 정보 직접 입력(이름·유형·정도) 세 가지 길
  2. **할 수 있는 일자리** — 조건에 따라 신청 가능/확인 필요/지금은 어려움으로 나눈 8개 사업과 진주 지역 근무지 10곳
  3. **서류** — 나라 기관(정부24·국민건강보험공단·복지로·고용24) 서류를 받아 신청서에 붙이는 화면. **기본 프록시(`https://daon-codef-proxy.mingun29.workers.dev`)가 미리 연결되어 있어 실제 간편인증 조회**가 동작하고, 사용자가 `연결 해제`를 누르면 시연 연출로 돌아간다. 둘을 화면에서 명확히 구분한다
  4. **신청** — 복지카드·기관 서류로 채운 정보는 그대로 두고, 빠진 칸(연락처·사는 곳·계좌·하고 싶은 말)만 적어 제출 → 접수번호와 접수증
- 상담(대화형 질문) 단계와 5단계 위저드는 **없다.** 화면마다 큰 버튼 하나로 다음 화면에 간다.
- 서버·빌드·패키지 없음. `index.html` **단일 파일**(HTML + CSS + JS)이며, 파일을 열면 바로 동작한다. 예외 둘 — 복지카드 OCR만 Tesseract.js 5.1.1을 CDN에서 지연 로드하고, 실제 기관 조회를 쓸 때만 사용자가 배포한 `proxy/`(Cloudflare Worker)를 부른다.
- 배포: GitHub Pages — https://mingun0729-jpg.github.io/daon-counselor/
- 출발점: 진주시지체장애인협회 일자리 업무 현장 경험(작성자 본인 근로 경험).

## 1-B. 실제 기관 조회(CODEF) 연동 구조

```
브라우저(index.html) → proxy/cloudflare-worker.js (Cloudflare Workers) → CODEF → 정부24 · 국민건강보험공단
```

- **키는 절대 저장소·브라우저에 두지 않는다.** `CODEF_CLIENT_ID`·`CODEF_CLIENT_SECRET`은 Worker secret에만 넣는다(`proxy/README.md`).
- 프론트엔드는 `daon.codef.v1`(localStorage)에 **프록시 주소·접속 토큰만** 저장한다. 저장된 설정이 없으면 `DEFAULT_PROXY_URL`(`https://daon-codef-proxy.mingun29.workers.dev`)을 써서 **처음 여는 사람도 바로 실제 조회**가 되고, `url`이 빈 값이면 사용자가 직접 해제한 상태로 보고 기본 주소를 다시 넣지 않는다(`기본 주소로 채우기` 버튼으로만 되돌린다). 본인확인 정보(성명·생년월일·휴대폰)는 메모리에만 두고 저장·복제하지 않는다.
- 프록시 엔드포인트는 화이트리스트 3개뿐: `/api/health`, `/api/auth/request`(1차), `/api/auth/complete`(2차).
- 2-Way 흐름: 1차 응답 `result.code === "CF-03002"` + `data.continue2Way === true` → `twoWayInfo`(`jobIndex`·`threadIndex`·`jti`·`twoWayTimestamp`)를 보관 → 사용자가 휴대폰에서 인증 → `[인증 완료 확인]` → `is2Way:true`, `simpleAuth:"1"`, `twoWayInfo`를 담아 같은 URL로 2차 요청. 추가인증 제한 270초, `simpleAuth:"1"` 반복은 2번까지(3번째 `CF-12872`).
- 지원 상품(2026-11-19 개발가이드 확인): `insurance` `/v1/kr/public/pp/nhis-join/identify-confirmation`(org 0002), `resident` `/v1/kr/public/mw/resident-registration-copy/issuance`(0001), `disability` `/v1/kr/public/mw/certificate/disability`(0001). `REAL_DOC_IDS`가 이 셋이다.
- **가짜 성공 금지** — 프록시가 없거나 기관이 거절하면 그 사실·응답 코드를 화면에 그대로 보여 주고 '직접 준비'로 넘긴다. 시연 데이터는 `[시연용 예시 데이터로 미리보기]` 버튼으로만 들어가고, 배지·로그도 `시연` / `실제 조회`로 구분한다.
- 장애인증명서의 `identity`는 개발가이드상 주민등록번호를 요구하지만 다온은 주민등록번호를 받지 않으므로 **생년월일을 보낸다**. 거절되면 응답 코드를 보여 주고 직접 발급으로 안내한다(주석·README 참고).

## 2. 파일 구조

```
index.html    # 프로토타입 전체 (이 파일 하나가 배포본)
README.md     # 기능·시연 방법 안내
CLAUDE.md     # 이 문서 (작업 규칙)
.nojekyll     # GitHub Pages Jekyll 처리 비활성화
proxy/        # 실제 기관 조회용 백엔드 프록시 (Pages와 별개로 Cloudflare에 배포)
  cloudflare-worker.js · wrangler.toml · README.md
```

로컬 원본은 별도 작업 공간의 `prototypes/disability-job-counselor.html`이며, 배포 전에는 항상 이 원본과 `index.html`을 동일하게 맞춘다(MD5 비교).

### `index.html` 내부 구성

| 위치 | 내용 |
| --- | --- |
| `<style>` | 디자인 토큰(`:root`) · 앱 틀(헤더·편하게 보기·단계 표시·하단 큰 버튼) · 화면별 카드 · 접근성 3모드(큰 글씨·고대비·쉬운 말) · 시트/모달 · 인쇄 |
| `.topbar` | 로고(눈 달린 ㅍ) · `#btnBack` · `#btnStartOver`(처음부터) + 편하게 보기 줄(`#btnBigText`, `#btnHighContrast`, `#btnVoice`, `#a11yRate`의 `#btnRateSlow`/`#btnRateNormal`, `#btnStopSpeak`) |
| `.steps` | 4단계 표시 `button.stp[data-goto="card|jobs|docs|submit"]` — 지나온 단계는 `✓`, 지금 단계는 `aria-current="step"` |
| `main` 안 5개 화면 | `#view-card`(카드 인식) · `#view-jobs` · `#view-docs` · `#view-submit` · `#view-done`. 한 번에 하나만 보이고 나머지는 `hidden` |
| `#view-card` | `#cardHome`(시작: `#btnScan` 복지카드, `#btnIdCard` 주민등록증, `#btnSamples`, `#btnManual`, 파일 입력 `#cardFile`·`#idFile`) / `#cardDone`(인식 결과 `#cardVisual`, 배려 안내 `#cardHint`, `#btnCardEdit`, `#btnCardAgain`) |
| `#view-jobs` | `#condWho`·`#btnCond`(조건 바꾸기), `#jobList`(라디오 카드), `#btnJobMore`, `#offBox`(지금은 어려운 일자리), `#workSection`(`#rankBox`/`#rankList` 희망 근무지 1·2·3순위 요약, `#workList` 순위 버튼이 붙은 근무지 카드, `#btnWorkMore`, `#assignRule` 배정 기준), `#supportBox`(근로지원 제도) |
| `#view-docs` | 진행 카드(`#docsTitle`·`#docProgTxt`·`#docBar`), **실시간 진행 로그** `#agentLog`/`#alList`, 기관 카드 `#agencyList`, **신분증 사진 카드** `#photoBox`(`#photoState`·`#photoHint`·`#btnIdPhoto`), 파일 카드 `#fileList`, `#selfBox`(직접 준비) |
| `#view-submit` | 자동 채움 안내 `#autoDesc`, 희망 근무지 순위 `#confirmRanks`(+`#btnRankEdit`), 입력 칸(`#inPhone`, `#inEmail`, `#inAddr`, `#inBank`+`#inAcct`)과 `#inMotiv`(+`#btnDraft`), **추가 신청서 항목(선택)** `#extraBox`/`#extraFields`(서식 1의 성별·소득수준·최종학력·전산능력·자격면허·보호자 연락처 등), `#formDocList`, **자격 판정** `#eligResult`, **자필 서명** `#sigPad`/`#sigState`, **서식 3종 탭** `#formTabs`/`#formPreviewFrame`/`#formMeta` |
| `#view-done` | 접수증 `#doneNo`·`#doneReceipt`, 인쇄 `#btnPrint`, ZIP `#btnZip`, 메일 `#btnMail` |
| `.dock` | 화면마다 **큰 버튼 하나** `#ctaMain` + 안내 `#dockNote`. 카드 화면(인식 전)과 완료 화면에서는 숨긴다 |
| 시트·모달 | `#sheet`(예시 카드·직접 고르기·조건 바꾸기·처음부터), `#ocr`(카드 읽기 4단계), `#login`(기관 로그인 — 실제/시연 분리), `#apiCfg`(기관 API 연결 설정), `#submitOv`(제출 4단계), `#fileView`(서류 미리보기 iframe) |
| `#printArea` | 인쇄용 컨테이너(화면에서는 `display:none`) |

### 스크립트 섹션 (IIFE 안, 주석의 번호와 대응)

| 섹션 | 주요 심볼 |
| --- | --- |
| 0. 공통 유틸 | `$`, `$$`, `esc`, `toast` |
| 0-B. 접근성·임시저장 | `a11y`(`big`·`contrast`·`voice`·`rate`), `applyA11y`, `setA11y`, `setRate`, `TTS_RATE_SLOW(0.82)`/`TTS_RATE_NORMAL(0.93)`, `speak`/`stopSpeak`(TTS), `setSpeakUI`, `checkKoreanVoice`, `announce` |
| 1. 이름표 | `TYPE_LABEL`, `TYPE_SHORT`, `SEVERITY_LABEL`, `WORK_LABEL`, `WORK_SHORT`, `ENV_LABEL`, `TRANSPORTS`, `AIDS`/`AIDS_LABEL`, `ORG` |
| 2. 상태 | `state` — `view`·`card`·`type`·`severity`·`workType`·`envs(Set)`·`selectedProgram`·`selectedWorkplace`(1순위 미러)·`workplaceRanks`(1·2·3순위)·`checked`·`fetched`·`form`(안에 `extra`·`lic`·`guardian`)·`receipt`·`easy` |
| 3. 기관 | `AGENCY`(정부24·건강보험·복지로·고용24·협회), `DOC_AGENCY`, `AGENT_DOC_META`/`agentMeta` |
| 4. 판별 규칙 | `ruleGeneralFull` ~ `ruleRemote`, `statusOf`, `PROGRAMS`(8개), `analyze()` |
| 5. 근로지원 | `buildSupports()`(7개 제도) |
| 6. 근무지 | `WORKPLACES`(10곳), `TAG_LABEL`, `WARN_TAGS`, `matchWorkplace`, `scoredWorkplaces`, `rankList`/`rankSync`/`setRanks`/`setRank`/`rankOf`/`rankText`(1·2·3순위), `fitScore`(적합도 점수) |
| 7. 서류 목록 | `COMMON_DOCS`, `EXTRA_DOCS`, `ALWAYS_EXTRA`, `docsFor` |
| 5(앱). 복지카드·주민등록증 | `CARD_SAMPLES`(7종), `OCR_STEPS`/`OCR_STEPS_ID`, `openSamples`/`openSampleConfirm`(예시 인물 확인), `startCardOcr(file, mode)`/`ensureOcrWorker`/`ocrPrepCanvas`/`ocrPass`(브라우저 로컬 OCR 파이프라인), `parseOcrText`/`mergeOcrPasses`(판독문 파싱·2패스 병합), `ocrAddrOf`(주민등록증 주소 줄), `openOcrProgress`/`setOcrPct`/`cancelOcr`, `openOcrReview(res, mode)`/`applyOcrDraft`(`mode:'id'`면 주소까지), `openOcrFailed`, `openManual`, `openOcr`/`finishOcr`, `pickIdCard`/`handleIdFile`(주민등록증), `applyCard`(`birth` 포함), `applyManual`, `applyProfile`(장애 유형별 배려: 시각=큰글씨+읽어주기, 지적·자폐성=쉬운 말, 정신=근무 시간·업무 조정 안내, 지체·뇌병변=큰 글씨·큰 버튼) |
| 6(앱). 화면 흐름 | `VIEW_ORDER`, `go`, `render`, `renderSteps`, `renderCard`, `renderDock` |
| 7(앱). 일자리 | `analyze` 결과를 `jobCardHtml`로, `kindOfProgram`·`workRows`·`pickDefaultWorkplace`, `renderWork`(진주 근무지 3장 + 더 보기)·`workCardHtml`(순위 버튼)·`renderRankSummary`, `renderSupports`, `openCond` |
| 8(앱). 서류 | `fetchState`(진행 로그·phase·mode), `requiredFetchDocs`, `assocDocs`, `docsStats`, `agencyGroups`, `renderDocs`, `renderAgentLog`/`pushLog`/`phaseLabel`, `openLogin`/`confirmLogin`, `fetchDocs`(시연 연출) |
| 8-B. 실제 연동 | `codef`(프록시 주소·health), `realState`, `loadCodef`/`saveCodef`, `codefFetch`(오류에 `hint`·`address`·`guide` 보존), `updateCfgBar`, `openCfg`/`closeCfg`/`testCfg`/`saveCfg`/`clearCfg`, `REAL_DOC_IDS`/`realDocs`, `renderLoginBody`/`setLoginButtons`, `cleanAddr`/`addrProblem`/`isRoadAddr`/`addrCheckHtml`/`updateAddrCheck`(주소 도우미), `startReal`/`realStep`/`completeTwoWay`/`realFail`/`finishReal`, `renderLoginRun`, `isAddrError`/`retryWithAddr`(CF-13006), `startTwoWayTimer`, `applyRealDoc`/`mergeRealIntoForm`/`realSummary`, `typeFromDisability`/`severityFromDisability` |
| 서류 실데이터 렌더 | `realHead`/`realCertDoc`(CODEF 응답 요약 문서 — `REAL_WM` 워터마크), `docShell(title, inner, wm)` |
| 9(앱). 신청 | `renderSubmit`(확인 카드 `#confirmCard` · 희망 근무지 순위 `renderConfirmRanks` · 필요 지원 칩 `aidChipsHtml`), `renderExtraFields`(서식 1 추가 항목 칩), `validateForm`(aria-invalid·role=alert), `readForm`, `clearFieldError`, `JOB_DEFAULT`, `buildDraftText`, `submitAll`, `makeReceipt`(순위 포함), `renderDone`, `birthText`/`maskedRrn`/`rrnMasked` |
| 9-B. 포커스 | `focusViewHeading`(화면 전환 → 제목), `focusBack`/`overlayReturn`(모달을 열었던 버튼으로 복원), `selectProgram`·순위 버튼(`data-work-rank`)·순위 비우기(`data-clear-rank`)·추가 항목 칩(`data-xkey`)이 재렌더 뒤 같은 버튼으로 포커스 |
| 10(앱). 인쇄·저장 | `printHtmlString`(새 탭 인쇄, 팝업 차단 시 `downloadHtml`), `printApp`, `saveAllZip`, `sendMail`, `allDocs` |
| 11(앱). 읽어주기 | `screenSummaryText`(화면별 대본), `speakScreen` |
| 12(앱). 저장·복원 | `snapshot`(v4), `saveNow`/`scheduleSave`/`restoreSaved`/`clearSaved`, `resetAll` |
| 13~15. 시트·이벤트·시작 | `openSheet`/`closeSheet`, `bindEvents`(이벤트 위임), `init` |
| 7-F. 서류 파일 | `DOC_STYLE`/`DOC_WM`, `DOC_FILE_META`/`DOC_TITLE`, `docFileFor`(HTML/SVG/**본인 첨부 사진 bytes** + 실제 Blob 크기), `photoDoc`/`photoExt`/`photoUrlOf`/`photoSig`/`readPhotoFile`/`attachPhotoDoc`/`reapplyPhotoDocs`(사진 서류), `certSpec`/`certDoc`, `svgCardDoc`, `docFileCard`/`docPendingCard`, `buildZip`(무압축 ZIP, `bytes` 항목 지원), `openFileView`/`saveDocFile`/`printDocFile` |
| 7-G. 공식 서식 3종 | `OF_STYLE`(A4 인쇄 CSS), `form1Pages`/`form2Pages`/`form3Pages`(원본 구조 그대로), `form1Doc`~`form3Doc`, `allFormsDoc`(3종 한 번에 인쇄), `obx`/`ofv`/`sigMark` |
| 7-H. 자격 판정 | `ELIG_DEF`, `eligDefault`, `eligibility`(지침 p.15·p.20·p.23·공고 4), `eligBadge`, `renderElig`, `renderEligResult`, `setElig` |
| 7-I. 자필 서명 | `sigPad`, `sigInit`/`sigRedraw`/`sigDown`/`sigMove`/`sigUp`, `sigStatus`, `sigClear`, `sigMode` |
| 7-J. 서식 탭·인쇄 | `FORM_TABS`, `renderFormTabs`, `selectFormTab`, `refreshFormPreview`, `printAllForms`/`printOneForm`/`saveOneForm`/`openFormInTab`, `buildSummaryJson` |

## 3. 데이터·수치 출처

- 모든 사업 종류·근무시간·보수·서류·선발 기준은 **2026년 장애인일자리 사업안내(보건복지부)** 기준이다. 예: 일반형 전일제 주 40시간(12월 37.5시간) 월 2,156,880원(12월 2,022,720원, 세전), 시간제 주 20시간 월 1,078,440원, 복지일자리 참여형 주 14시간 이내 월 577,920원.
- 수치를 바꿀 때는 **출처 연도를 함께 표기**하고, 화면 하단 고지의 "2026년 장애인일자리 사업안내 기준" 문구도 같이 갱신한다.
- 근무지 10곳과 신청서 예시 값(성명·연락처·거주지·계좌)은 **가상 예시**다. 실제 기관·개인 정보로 바꾸지 않는다. 다만 **접수처 안내의 기관명·주소·대표전화**는 공개된 공식 정보(**(사)경남지체장애인연합회 진주시지회**, 경남 진주시 대신로 232번길 16, ☎ 055-755-0008)를 실제 값으로 쓰고 `ORG` 상수에서 관리한다.
- 복지카드·주민등록증 인식은 **실제 브라우저 로컬 OCR**이다(`startCardOcr(file, mode)`). Tesseract.js 5.1.1(`kor+eng`)을 CDN에서 **필요할 때 한 번만** 불러오고, 사진은 그레이스케일·대비·이진화/샤프닝 두 가지로 전처리해 2패스(PSM 6)로 읽고, 6개 항목 중 3개 미만이면 원본에 가까운(이진화·샤프닝 없는) 세 번째 패스를 더 돌린 뒤 `mergeOcrPasses`로 항목별 최선값을 고른다. `mode='id'`(주민등록증)는 `ocrAddrOf`가 '주소' 라벨 뒤/시·도로 시작하는 줄을 읽어 **주소**까지 채운다. **사진 픽셀은 어디로도 전송하지 않는다**(내려받는 것은 엔진·언어 데이터뿐) — 이 고지를 지우지 않는다. 주민등록번호는 앞 6자리와 성별 숫자만 쓰고 뒷자리는 저장하지 않는다(`810716-1******`). 생년월일은 앞 6자리+성별숫자로 계산해 `state.form.birth`(YYYYMMDD)에 넣어 서식 1에 그대로 반영된다. 엔진을 못 받거나 글자를 못 읽으면 `openOcrFailed`가 안내 후 직접 입력·예시 인물로 잇는다. 예시 인물 경로(`openSampleConfirm` → `openOcr` 연출)는 그대로 남아 있다.
- **주민등록증 사진 = 신분증 사본** — 1단계든 3단계 `#photoBox`든, 올린 사진은 `state.photos.id`(메모리에만)에 보관하고 `state.fetched.id`를 `photo:true`로 표시한다. `docFileFor`가 그 서류만 **원본 사진 파일**(JPG/PNG, `bytes`)로 돌려주므로 미리보기·저장·ZIP이 모두 사진 그대로다. 사진은 저장(localStorage)하지 않으므로 새로 고치면 `restoreSaved`가 `photo` 첨부를 지우고 로그에 남긴다. 사진으로 붙인 서류는 `reapplyPhotoDocs`로 프로그램 선택·재렌더 뒤에도 유지한다.
- **장애인증명서 주소** — 정부24는 주소검색 결과가 **한 건**인 주소만 통과시키고, 아파트 이름만·시·도만·번지 없는 '동'·괄호 메모가 섞인 주소는 `CF-13006`을 돌려준다. `cleanAddr`/`addrProblem`(프론트)과 `cleanAddress`/`addressProblem`(프록시)이 같은 규칙으로 ① 다듬고 ② 번지가 없으면 CODEF을 부르지 않고 막고 ③ `CF-13006`이면 보낸 주소를 보여 주며 `retryWithAddr`(휴대폰 인증 한 번 더)로 고쳐 다시 요청하게 한다. 이 규칙을 느슨하게 풀지 않는다.
- 기관 로그인·서류 자동 수집·자동 첨부·접수는 **기본값이 시연 연출**이다. 외부 요청 0건의 모의(Mock)이며, 화면 고지("시연용 가상 로그인", "실제로는 본인이 직접 발급받아야 해요")를 지우지 않는다. **프록시를 연결했을 때만** `startReal`이 실제 API를 부른다. 실제 모드에서도 받지 못한 서류는 '직접 준비'로 남기고 가짜로 채우지 않는다.
- 메일 보내기는 **빈 수신자 `mailto:`만** 쓴다. 특정 개인·기관 이메일 주소를 코드에 넣지 않는다.

## 4. 수정 시 주의사항

1. **단일 파일 유지** — 외부 CDN·폰트·라이브러리·이미지 파일을 추가하지 않는다. 아이콘은 이모지 또는 인라인 SVG만 사용한다. 유일한 예외는 복지카드 OCR용 Tesseract.js 동적 로드(`OCR_LIB_URL`)이며, 이것도 없으면 앱의 다른 기능은 그대로 오프라인에서 동작하고 OCR만 안내 후 직접 입력으로 넘어간다.
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
15. **localStorage 키 고정** — 접근성 설정 `daon.a11y.v1`(`big`·`contrast`·`voice`·`rate`), 자동 임시저장 `daon.state.v1`(내부 스키마 `v: 4`), 프록시 설정 `daon.codef.v1`(`url`·`token` — 저장값이 없으면 기본 프록시, 빈 `url`은 직접 해제). 저장값은 브라우저 밖으로 나가지 않으며 `resetAll`에서 앞의 둘을 비운다. 실제 조회값(`state.real`)과 올린 사진(`state.photos`)은 저장하지 않는다(메모리에만). 스키마를 바꾸면 `v`를 올리고 `restoreSaved`에서 검증한다.
16. **음성 안내** — 외부 TTS 라이브러리를 넣지 않고 `window.speechSynthesis`만 사용한다. 한국어 음성이 없는 기기에서는 음성 안내를 켜지 않고 `NO_KO_VOICE_MSG`로 안내한다.
16-B. **낭독은 한 곳에서** — 화면 낭독 안내는 `#a11yStatus` 라이브 리전 한 곳만 쓴다. `toast()`는 보이는 안내만 담당하고(80ms 뒤 announce로 넘김), `announce()`가 바로 오면 같은 말을 두 번 읽지 않는다. `#toast`에 `role=status`를 다시 붙이지 않는다.
16-C. **하단 고정 버튼과 시트 여백** — 시트 안 `.stickybtns`는 화면 아래에 붙어 마지막 내용을 가릴 수 있다. 내용을 바꾼 뒤 `fitSheetFoot(오버레이)`를 불러, 내용이 넘칠 때만 시트에 아래 여백(`.hasfoot`)을 준다. 새 시트를 만들면 같은 처리를 넣는다.
16-D. **실제/시연 로그 분리** — `fetchDocs`(시연)는 시작할 때 `fetchState.log`를 비우고, 실제 조회를 중단하면 `closeLogin`이 `⏹ 중단` 항목을 남긴다. 한 로그에 실제·시연 기록이 섮이면 안 된다.
17. **단계 표시와 화면 이동** — 화면 이동은 항상 `go(view)`를 거쳐 `state.view`·화면 표시·단계 표시·하단 버튼을 함께 맞춘다. 화면을 직접 감추지 않는다. `go()`는 새 화면 제목(`h1`/`h2`)으로 포커스를 옮기고, 목록을 다시 그리는 함수는 재렌더 뒤 선택한 라디오로 포커스를 돌려준다(`focusBack`). 모달은 `overlayReturn`으로 열었던 버튼에 포커스를 돌린다.
18. **입력 오류 연결** — 필수 입력은 `required`(aria-required)·`aria-describedby`(오류 span)·`aria-invalid`·오류 문구 `role="alert"`를 함께 쓴다. `validateForm`은 필드 안 모든 입력의 `aria-invalid`를 같이 맞춘다. 새 입력칸을 추가하면 label·오류 문구·연결을 같은 커밋에 넣는다.
19. **4단계 확인 카드** — `#view-submit` 맨 위 `#confirmCard`에서 이름·생년월일·주소·필요 지원·이동 수단을 확인·수정하게 하고, 값은 `state.form`에 저장되어 `form1Doc`~`form3Doc`·인쇄·ZIP·접수증·미리보기에 그대로 들어간다. 이름·생년월일을 가짜로 만들지 않는다(`birthText()`는 입력값만 쓰고 비어 있으면 `—`).
20. **공식 서식 3종은 원본 1:1** — 제목·표 구조·항목명·문구를 기장군 2027년 모집공고 [서식1]~[서식3]과 진주시 참여신청서식에서 그대로 옮긴다. 구조를 임의로 바꾸거나 항목을 지어내지 않는다. 값이 없으면 원본처럼 빈칸으로 두고, 글자를 읽지 못하는 항목은 억지로 채우지 않는다.
21. **자격 판정은 지침 수치** — `eligibility()`의 제한·예외는 「2026년 장애인일자리 사업안내」와 모집공고 근거를 주석으로 남긴다. 제한이 있으면 `submitAll`이 접수를 막고, 서명이 없으면 서명란으로 포커스를 옮긴다.
22. **개인정보** — 서명 이미지·올린 사진(주민등록증·복지카드)은 브라우저 안에서만 다루고 서버로 보내지 않는다. 사진은 `state.photos`(메모리)에만 두고 localStorage·ZIP 외에는 어디에도 쓰지 않는다. 공개 저장소이므로 커밋 금지(`CLAUDE.md` 상단 규칙).
18. **진행 로그** — 기관 서류 수집은 `fetchState.log`에 쌓고 `renderAgentLog()`가 최신 순으로 그린다. 단계는 `connect → login → issue → attach`이며, 새 단계를 넣으면 `phaseLabel()`과 기관 카드 상태 문구를 함께 고친다.

## 5. Claude Code 협업 규칙

- **개인정보 절대 커밋 금지** — 실명·주민등록번호·연락처·주소·계좌·복지카드 사진·스크린샷 원본을 저장소에 넣지 않는다. **CODEF 키·프록시 접속 토큰도 넣지 않는다.** 이 저장소는 **공개(Public)** 이며 GitHub Pages로 누구나 볼 수 있다. 예시 값은 `김다온(가명)`, `010-1234-5678`, `경상남도 진주시 ○○로 12 (예시)` 같은 가상 값만 쓴다.
- **시연용 고지 유지** — 복지카드 인식·기관 로그인·서류 자동 첨부·접수는 시연 연출임을 화면과 코드 주석 모두에 남긴다.
- 커밋 전 최소 확인:
  1. `index.html` 하나로 열리는지(콘솔 오류 0)
  2. 예시 카드 → 인식 → 일자리 → 서류(기관 로그인 모달·진행 로그·파일 카드) → 신청 → 접수증까지 이어지는지
  3. 되돌아가기(이전 화면·단계 표시·처음부터)가 동작하는지
  4. 모바일 폭(360~420px)에서 가로 스크롤이 없는지(큰 글씨·고대비·쉬운 말 모드 포함)
  5. `proxy/`를 고쳤으면 Node 18+에서 `node --input-type=module -e "await import('./proxy/cloudflare-worker.js')"`로 로드되는지, `/api/health`·`/api/auth/request`·`/api/auth/complete` 응답 모양(`ok`·`status`·`twoWayInfo`·`normalized`)이 그대로인지 확인
  6. 실제/시연 구분이 흐려지지 않았는지 — 프록시 미연결에서 실제 요청 0건, 실제 모드에서 받지 못한 서류는 '직접 준비'
- 배포는 `main` 브랜치에 push하면 GitHub Pages가 자동 반영한다(1분 내외). 반영 후 실제 URL에서 새 기능 문구가 보이는지 확인한다.
- 이 저장소는 공모전 제출·시연용이다. 기능을 늘리기보다 **시연 흐름이 끊기지 않는 것**을 우선한다.
