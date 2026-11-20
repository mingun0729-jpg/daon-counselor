# 다온(DAON) 기관 API 프록시 — CODEF 간편인증

다온은 GitHub Pages에서 도는 **정적 페이지**입니다. CODEF의 `clientId`·`clientSecret`을 브라우저에 둘 수 없고, 브라우저에서 CODEF를 직접 부르면 CORS에 막힙니다. 그래서 **작은 서버 한 개(Cloudflare Worker)** 가 가운데에서 키를 들고 CODEF를 대신 호출합니다.

```
다온 화면(브라우저)  →  이 Worker(키 보관)  →  CODEF  →  정부24 / 국민건강보험공단
```

이 폴더의 파일

| 파일 | 설명 |
| --- | --- |
| `cloudflare-worker.js` | Worker 본체(단일 파일). 이걸 배포합니다. |
| `wrangler.toml` | 배포 설정(이름·환경변수). |
| `README.md` | 이 문서. |

---

## 3단계로 끝내기

### 1단계 — CODEF 키 받기 (5분)

1. <https://codef.io> 에서 회원가입합니다. 가입만으로 **데모(development) 서버**를 하루 100회까지 써 볼 수 있습니다.
2. 로그인 → **MY > 키 관리**에서 다음 세 값을 확인합니다.
   - `CODEF_CLIENT_ID`
   - `CODEF_CLIENT_SECRET`
3. 정부24·건강보험공단 같은 공공기관 상품은 **데모 신청**으로 먼저 확인하고, 실제 서비스는 정식 신청(사업자 정보 필요) 후 `CODEF_ENV=api`로 바꿉니다.

> 데모 서버는 실제 개인 인증을 끝까지 받지 못할 수 있습니다. 데모에서는 "연결·2차 인증 흐름"이 도는지 확인하고, 실제 서류는 정식 계약 후 조회하세요.

### 2단계 — Worker 배포 (10분)

**방법 A. 명령어로 (권장)**

```bash
cd proxy
npx wrangler login                    # 브라우저로 Cloudflare 로그인
npx wrangler secret put CODEF_CLIENT_ID
npx wrangler secret put CODEF_CLIENT_SECRET
npx wrangler deploy
```

배포가 끝나면 `https://daon-codef-proxy.<내계정>.workers.dev` 주소가 나옵니다.

**방법 B. Cloudflare 웹 화면으로**

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Worker**.
2. `cloudflare-worker.js` 내용을 통째로 붙여넣고 **Deploy**.
3. **Settings > Variables and Secrets** 에서
   - `CODEF_CLIENT_ID` (Secret)
   - `CODEF_CLIENT_SECRET` (Secret)
   - `CODEF_ENV` = `demo` (일반 변수)
   - `ALLOWED_ORIGIN` = `https://mingun0729-jpg.github.io` (일반 변수)
   - (선택) `PROXY_TOKEN` = 아무 긴 문자열

4. **Settings > Triggers** 의 주소(`*.workers.dev`)를 복사합니다.

### 3단계 — 다온 화면에서 연결

1. <https://mingun0729-jpg.github.io/daon-counselor/> 를 엽니다.
2. **서류** 화면 → **⚙️ 기관 API 연결 설정** → 위 주소를 붙여넣고 **연결 테스트**.
3. `연결됨 · demo · 실제 조회 사용 가능` 이 뜨면 **저장**.
4. 서류 화면의 **기관 로그인** → 성명·생년월일·휴대폰·통신사·인증수단 입력 → **인증 요청**.
5. 휴대폰의 카카오톡/네이버/PASS/토스에서 인증을 마친 뒤 화면의 **[인증 완료 확인]** 을 누릅니다.

`PROXY_TOKEN`을 설정했다면 화면 설정의 **접속 토큰** 칸에 같은 값을 넣어야 합니다.

---

## 환경변수

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `CODEF_CLIENT_ID` | O | CODEF 클라이언트 아이디 (secret으로 넣기) |
| `CODEF_CLIENT_SECRET` | O | CODEF 시크릿 (secret으로 넣기) |
| `CODEF_ENV` | | `demo`(기본, `https://development.codef.io`) 또는 `api`(`https://api.codef.io`) |
| `ALLOWED_ORIGIN` | | 허용할 사이트 주소. 기본 `*`. 배포 시 `https://mingun0729-jpg.github.io` 권장 |
| `PROXY_TOKEN` | | 지정하면 `X-Daon-Token` 헤더가 같아야 응답. 남용 방지용 |
| `CODEF_MOCK` | | `1`이면 CODEF를 부르지 않고 **모의 응답**. 응답에 `mock:true`가 붙고 화면에도 '모의 응답'으로 표시됩니다. 연결 화면 확인용 |
| `CODEF_TIMEOUT_MS` | | CODEF 호출 제한시간(기본 30000) |
| `ANTHROPIC_API_KEY` | | 다온 채팅의 Claude 응답용 API 키 (**secret**, 유료). 있으면 Claude, 없으면 Cloudflare Workers AI(`wrangler.toml`의 `[ai]` 바인딩, 키 불필요·무료 한도 내)로 답함 |
| `AI_MODEL` | | Workers AI 모델 (기본 `@cf/google/gemma-3-12b-it`) |
| `CLAUDE_MODEL` | | 채팅 모델 (기본 `claude-haiku-5-5`) |
| `CHAT_RATE_PER_MIN` | | IP당 분당 채팅 질문 수 (기본 12) |
| `CHAT_TIMEOUT_MS` | | Claude 호출 제한시간 (기본 20000) |

### 다온 채팅 Claude 연결 (`POST /api/chat`)

```
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

- 규칙이 못 알아듣는 말(fallback)과 안내 질문(info)만 Claude로 갑니다. 화면 이동·일자리·서류·전화·알림은 앱이 직접 처리합니다.
- 브라우저는 최근 대화 8개·안내 자료·조건 요약(장애 유형·정도·지역·협회원 여부)만 보냅니다. 성명·주민번호·주소·사진은 보내지 않습니다.
- 키가 없거나 호출이 실패하면 화면은 기존 규칙 답으로 돌아갑니다(에러 문구를 보이지 않음).
- 공개 주소라 호출 비용이 새지 않도록 `ALLOWED_ORIGIN`을 GitHub Pages 주소로 좁히고, 필요하면 `PROXY_TOKEN`을 쓰세요.

---

## 열려 있는 주소

| 주소 | 하는 일 |
| --- | --- |
| `GET /api/health` | 연결 확인. 키 설정 여부·환경·지원 서류 목록. **비밀값은 돌려주지 않습니다.** |
| `POST /api/auth/request` | 1차 요청. `{ docId, profile:{name,birth,phone,telecom,auth,address}, id? }` |
| `POST /api/auth/complete` | 2차 요청. 같은 body + `{ twoWayInfo:{jobIndex,threadIndex,jti,twoWayTimestamp} }` |

응답 공통: `{ ok, status: "twoWay" | "done" | "error", doc, agency, result:{code,message} }`

- `twoWay`: `twoWayInfo`를 그대로 담아 `/api/auth/complete`로 다시 보내면 됩니다.
- `done`: `normalized`에 화면에 쓸 값만 추려서 담습니다(성명·가입자구분·사업장·자격취득일 / 세대주·주소 / 장애유형·정도 등).
- `error`: `{ ok:false, code:"CF-…", message, result }`. 주소 때문에 실패한 경우(`CF-13006` 등)에는 `hint:"address_no_result"`, `address`(실제로 보낸 주소), `guide`(고치는 법)가 함께 옵니다. 화면은 이 값으로 '주소 고쳐 다시 인증' 상자를 띄웁니다.
- 주소를 보내기 전에 `addressProblem`이 번지(숫자)가 없거나 동·읍·면이 없는 주소를 **CODEF을 부르지 않고** 400(`input_address_number`·`input_address_dong`·`input_address_short`)으로 돌려줍니다 — 간편인증을 헛되이 쓰지 않게 하기 위해서입니다.

---

## 실제 CODEF 스펙 (2026-11-19 개발가이드에서 확인)

- 토큰: `POST https://oauth.codef.io/oauth/token`, `grant_type=client_credentials&scope=read`, Basic 인증. **약 7일 유효** → 메모리에 캐시.
- 요청 본문: JSON을 `encodeURIComponent` 한 문자열로 보냅니다. 응답이 URL 인코딩되어 오면 풀어서 읽습니다.
- 2-Way: 1차 응답 `result.code === "CF-03002"` + `data.continue2Way === true` → `data`의 `jobIndex`·`threadIndex`·`jti`·`twoWayTimestamp`를 `twoWayInfo`로 담아 `is2Way:true`, `simpleAuth:"1"`과 함께 같은 URL로 재요청.
- 간편인증: `loginType="5"`, `loginTypeLevel` `1`카카오 `5`PASS `6`네이버 `8`토스. PASS면 `telecom` 필수 — CODEF 코드는 `0`SKT(알뜰폰 포함) `1`KT(알뜰폰 포함) `2`LG U+(알뜰폰 포함) 세 가지뿐이고 알뜰폰은 별도 코드가 없어 쓰는 망의 코드로 보냅니다. 화면에서는 통신사 6가지(SKT·KT·LG U+·SKT 알뜰폰·KT 알뜰폰·LG U+ 알뜰폰)를 고를 수 있고, 알뜰폰 선택은 같은 망 코드로 매핑됩니다. 통신사 값은 `SKT`·`KT`·`LGU`·`SKT_MVNO`·`KT_MVNO`·`LGU_MVNO`(별칭 `LGU+`·`LGT`·`LG`도 허용).
- 추가인증 제한시간 **270초(4분 30초)**, 상품 전체 300초. 인증을 마치지 않고 `simpleAuth:"1"`을 반복하면 2번까지 재시도되고 3번째에 `CF-12872`.

| 다온 서류 | CODEF 상품 | 엔드포인트 | organization |
| --- | --- | --- | --- |
| 건강보험 자격득실확인서 (`insurance`) | 민원여기요 자격득실확인 | `/v1/kr/public/pp/nhis-join/identify-confirmation` | `0002` |
| 주민등록등본 (`resident`) | 주민등록등본 교부 | `/v1/kr/public/mw/resident-registration-copy/issuance` | `0001` |
| 장애인증명서 (`disability`) | 장애인 증명서 | `/v1/kr/public/mw/certificate/disability` | `0001` |

### 장애인증명서의 `address` (2026-11-20 확인)

정부24 장애인증명서 발급 화면은 **신청인 주소를 주소검색으로 먼저 찾고**, 그 결과로 관할 발급기관(시·군·구)을 정합니다. CODEF은 이 검색창에 `address` 값을 그대로 넣고 **한 건으로 떨어지는 주소**만 통과시킵니다(같은 정부24 스크래핑 상품 명세도 “주소검색 입력값 사용 – 단일 주소 나오는 입력값”, 예: `신도림동 642`). 그래서:

- 아파트 이름만(`경상남도 진주시 신진주 포레나`), 시·도만, 번지 없는 `동` → 결과 0건 또는 여러 건 → **정부24가 `CF-13006`**(“검색결과가 없습니다. … 정확한 주소인지 다시 한번 확인해 주세요.”)을 돌려줍니다.
- 괄호 메모·우편번호가 섞인 문장(`… 16 (상대동, 52782)`)도 0건이 되기 쉬워 프록시가 걷어냅니다(`cleanAddress`).
- `CF-13006`은 로그인(2차 인증) 뒤에 나므로, 주소를 고쳐 다시 하려면 **간편인증을 한 번 더** 받아야 합니다. 화면은 그 사실을 미리 적어 둡니다.
- 지번(`진주시 가좌동 123-4`)을 권장하고, 도로명은 보내되 “결과가 없으면 지번으로 바꿔 보세요” 안내를 함께 띄웁니다.

### 확인이 더 필요한 부분 (숨기지 않고 적습니다)

- **장애인증명서의 `identity`(2026-11-20 수정)**: 개발가이드 표에는 `loginType 3·5·6`에서 `identity`가 필수이고 값은 "주민등록번호 13자리"입니다. 생년월일 8자리만 보내면 기관이 `CF-12100`("사업자번호(주민등록번호)가 잘못되었습니다")으로 거절했습니다. 그래서 프록시는 ① 생년월일에서 앞 6자리(YYMMDD)를 만들고 ② 화면이 보낸 주민등록번호 뒷자리 7자리(`profile.rrnBack`, 13자리 `profile.identity13`도 받음)를 붙여 13자리를 만들어 `identity`로 보냅니다(`identity13For`). 뒷자리가 없거나 7자리 숫자가 아니면 CODEF을 부르지 않고 `400 input_rrn_back`, 생년월일 세기와 뒷자리 첫 숫자가 어긋나면 `400 input_rrn_back_century`를 돌려줍니다. 받은 뒷자리는 요청 처리에만 쓰고 저장하지 않으며, `CF-12100`이면 `hint: rrn_mismatch`와 다시 넣는 법(`guide`)을 함께 줍니다.
- **아직 확인하지 못한 것**: 실제 카드 소지자의 진짜 주민등록번호 13자리로 `CF-00000`까지 받아 본 적은 없습니다(지인 테스트에서 `CF-12100`이 나온 원인이 생년월일 8자리 전송이라는 것은 CODEF 스펙과 응답 코드로 판단한 것입니다). 첫 실제 조회에서 결과를 확인해야 합니다.
- **건강보험 하루 발급 한도**: 개발가이드에 "하루에 인당 10건 초과 발급 불가"가 있습니다.
- **복지로(수급자 증명서)**: 2026-11-19 기준 CODEF 개발가이드 상품 검색에 **수급자 관련 상품이 없습니다.** 그래서 다온은 복지로를 '자동 조회 불가 · 직접 발급'으로 표시합니다.
- **데모 서버**: 추가인증 상품은 데모에서 끝까지 결과가 오지 않을 수 있습니다.

---

## 보안

- 키는 **Worker secret**에만 있습니다. 저장소·브라우저·화면 어디에도 남기지 않습니다.
- Worker는 요청마다 받은 본인확인 정보를 CODEF로 넘기고 **저장하지 않습니다**(로그·DB 없음). 서버 메모리에는 CODEF 토큰만 잠시 둡니다.
- `ALLOWED_ORIGIN`을 다온 주소로 좁히고 `PROXY_TOKEN`을 걸어 두면, 주소를 아는 다른 사람이 다온의 CODEF 쿼터를 쓰기 어렵습니다.
- 화면은 주민등록번호 뒷자리 7자리만, **장애인증명서를 조회할 때만** 받아 요청 본문에만 싣고 저장하지 않습니다(입력칸은 요청 직후 비우고, 인증이 끝나면 메모리의 값도 지움). 기관이 돌려준 주민등록번호는 `maskRrn()`으로 가려서만 내보냅니다.

## 비용

- Cloudflare Workers 무료 한도(하루 10만 요청) 안에서 충분합니다.
- CODEF는 상품별 과금입니다. 키를 발급받으면 **호출마다 비용이 발생**할 수 있으니 데모/정식 한도를 확인하세요.

## 문제가 생기면

| 증상 | 확인 |
| --- | --- |
| `configured:false` | secret 두 개가 들어갔는지 (`wrangler secret list`) |
| 401 `proxy_token` | 화면 설정의 접속 토큰과 `PROXY_TOKEN`이 같은지 |
| CORS 오류 | `ALLOWED_ORIGIN`에 다온 주소가 들어갔는지 |
| `CF-12872` | 인증을 마치지 않고 [인증 완료 확인]을 3번 눌렀습니다. 다시 **인증 요청**부터 |
| `CF-03002`가 계속 | 휴대폰에서 인증을 아직 완료하지 않았습니다. 인증 후 다시 [인증 완료 확인] |
| 503 `proxy_no_keys` | Worker에 CODEF 키 secret이 없습니다 |
