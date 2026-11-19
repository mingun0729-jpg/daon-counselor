/**
 * 다온(DAON) — CODEF 간편인증 프록시 (Cloudflare Workers 단일 파일)
 * =================================================================
 * 다온은 GitHub Pages에서 도는 정적 페이지라 CODEF의 clientId·clientSecret을
 * 브라우저에 둘 수 없고, CORS도 막힌다. 이 Worker가 그 사이에서
 *   브라우저 → (이 프록시) → CODEF OAuth·상품 API → 정부24 / 국민건강보험공단
 * 을 중계한다. 키는 Worker의 환경변수(secret)에만 있고 저장소에는 없다.
 *
 * 엔드포인트(화이트리스트)
 *   GET  /api/health          연결 확인 — 키 설정 여부·환경·지원 서류 목록
 *   POST /api/auth/request    1차 요청(간편인증 요청 발송). CF-03002면 twoWayInfo를 돌려준다.
 *   POST /api/auth/complete   2차 요청(is2Way=true, simpleAuth="1"). 실제 서류 데이터를 돌려준다.
 *
 * 환경변수
 *   CODEF_CLIENT_ID      (secret) CODEF 클라이언트 아이디
 *   CODEF_CLIENT_SECRET  (secret) CODEF 시크릿
 *   CODEF_ENV            demo | api   (기본 demo = https://development.codef.io)
 *   ALLOWED_ORIGIN       허용 오리진 (기본 * , 배포 시 https://mingun0729-jpg.github.io 권장)
 *   PROXY_TOKEN          (선택) 지정하면 X-Daon-Token 헤더가 일치해야 응답한다.
 *                        공개 주소를 아무나 써서 CODEF 쿼터를 태우는 것을 막는 용도.
 *   CODEF_MOCK           "1"이면 CODEF를 호출하지 않고 고정 응답을 돌려준다(연결 시험용).
 *                        응답에 mock:true가 붙고, 화면도 '모의 응답'으로 표시한다.
 *   CODEF_TIMEOUT_MS     CODEF 호출 제한시간 (기본 30000)
 *
 * 실제 스펙 근거(developer.codef.io, 2026-11-19 확인)
 *   · 토큰  : POST https://oauth.codef.io/oauth/token  grant_type=client_credentials, Basic 인증
 *   · 1차   : POST {base}/v1/...  body = encodeURIComponent(JSON)
 *   · 추가인증: result.code === "CF-03002" && data.continue2Way === true
 *              → data의 jobIndex·threadIndex·jti·twoWayTimestamp를 twoWayInfo로 저장
 *   · 2차   : 같은 URL에 is2Way=true, simpleAuth="1", twoWayInfo를 더해 재요청
 *   · 간편인증 loginType="5", loginTypeLevel 1:카카오 5:PASS 6:네이버 8:토스
 *   · 자격득실확인  /v1/kr/public/pp/nhis-join/identify-confirmation  (organization 0002)
 *   · 주민등록등본  /v1/kr/public/mw/resident-registration-copy/issuance (organization 0001)
 *   · 장애인증명서  /v1/kr/public/mw/certificate/disability            (organization 0001)
 *
 * 주의: 이 파일에는 어떤 개인정보·키도 넣지 않는다. 요청마다 사용자가 보낸
 *       본인확인 정보를 그대로 CODEF에 넘기고, 서버에는 저장하지 않는다.
 */

const OAUTH_URL = 'https://oauth.codef.io/oauth/token';
const BASE_URL = {
  demo: 'https://development.codef.io',
  api: 'https://api.codef.io'
};

/* 간편인증 수단 → CODEF loginTypeLevel */
const AUTH_LEVEL = { kakao: '1', naver: '6', pass: '5', toss: '8' };
const AUTH_LABEL = { kakao: '카카오톡', naver: '네이버', pass: 'PASS', toss: '토스' };
/* 통신사 → CODEF telecom (PASS 인증에서 필수) */
const TELECOM_CODE = { SKT: '0', KT: '1', LGU: '2' };

/**
 * 지원 서류. path·organization·기본 파라미터는 CODEF 개발가이드에서 확인한 값이다.
 * identityNote: 이 서류의 identity(사용자 식별값) 요구사항 메모.
 */
const PRODUCTS = {
  insurance: {
    label: '건강보험 자격득실확인서',
    agency: '국민건강보험공단',
    path: '/v1/kr/public/pp/nhis-join/identify-confirmation',
    organization: '0002',
    identity: 'birth',       // 개발가이드: loginType=5일 때 identity = 생년월일(YYYYMMDD)
    defaults: {
      useType: '0',          // 0 전체 / 1 직장가입자 / 2 지역가입자 / 3 가입자 전체
      isIdentityViewYN: '0', // 주민번호 뒷자리 비공개
      originDataYN: '0',
      originDataYN1: '0'
    }
  },
  resident: {
    label: '주민등록등본',
    agency: '정부24',
    path: '/v1/kr/public/mw/resident-registration-copy/issuance',
    organization: '0001',
    identity: 'none',        // 개발가이드: loginType=5(회원 간편인증)에서는 identity 불필요
    defaults: {
      pastAddrChangeYN: '0',
      inmateYN: '0',
      relationWithHHYN: '1',
      changeDateYN: '0',
      compositionReasonYN: '0',
      isIdentityViewYn: '0', // 주민번호 전체 미공개
      isNameViewYn: '0',     // 다른 세대원 이름 미포함
      originDataYN: '0'
    }
  },
  disability: {
    label: '장애인증명서',
    agency: '정부24',
    path: '/v1/kr/public/mw/certificate/disability',
    organization: '0001',
    // 개발가이드 표에는 loginType 3·5·6에서 identity 필수로 적혀 있고,
    // 값 설명은 '주민등록번호 13자리(생년월일 미입력 시)'다. 다온은 주민등록번호를
    // 받지 않으므로 생년월일을 보낸다. 기관이 거절하면 그 응답 코드를 화면에 그대로
    // 보여주고, 사용자는 '직접 발급'으로 넘어간다(가짜 성공을 만들지 않는다).
    identity: 'birth',
    requiresAddress: true,
    defaults: {
      isIdentityViewYn: '0',
      originDataYN: '0'
    }
  }
};

/* 토큰 캐시(인스턴스 메모리). access_token은 약 7일 유효. */
let tokenCache = { key: '', token: '', exp: 0 };

/* ---------------------------------------------------------------- util */

function corsHeaders(env, request) {
  const allow = (env && env.ALLOWED_ORIGIN) || '*';
  let origin = allow;
  if (allow !== '*') {
    const reqOrigin = request && request.headers.get('Origin');
    origin = reqOrigin && allow.split(',').map(function (s) { return s.trim(); }).indexOf(reqOrigin) > -1 ? reqOrigin : allow.split(',')[0].trim();
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Daon-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(body, status, env, request) {
  const headers = corsHeaders(env, request);
  headers['Content-Type'] = 'application/json; charset=utf-8';
  headers['Cache-Control'] = 'no-store';
  return new Response(JSON.stringify(body), { status: status || 200, headers: headers });
}

function digits(s) {
  return String(s == null ? '' : s).replace(/[^0-9]/g, '');
}

function maskRrn(v) {
  const s = String(v == null ? '' : v);
  if (!s) { return ''; }
  const d = s.replace(/[^0-9]/g, '');
  if (d.length >= 7) { return d.slice(0, 6) + '-' + d.slice(6, 7) + '******'; }
  return s;
}

/** URL-encoded 응답이면 풀어서 JSON으로. 실패하면 원문 일부를 담아 돌려준다. */
function decodeBody(text) {
  const raw = String(text == null ? '' : text).trim();
  const parse = function (s) { try { return JSON.parse(s); } catch (e) { return null; } };
  let out = parse(raw);
  if (out) { return out; }
  let decoded = raw.replace(/\+/g, ' ');
  try { decoded = decodeURIComponent(decoded); } catch (e) { /* 원문 유지 */ }
  out = parse(decoded);
  if (out) { return out; }
  return { _unparsed: raw.slice(0, 400) };
}

function httpError(status, message, code) {
  const e = new Error(message);
  e.status = status;
  e.code = code || '';
  return e;
}

function allowed(request, env) {
  if (!env || !env.PROXY_TOKEN) { return true; }
  const given = request.headers.get('X-Daon-Token') || '';
  return given === env.PROXY_TOKEN;
}

/* --------------------------------------------------------- CODEF 호출 */

async function getToken(env) {
  const id = env.CODEF_CLIENT_ID;
  const secret = env.CODEF_CLIENT_SECRET;
  if (!id || !secret) {
    throw httpError(503, 'CODEF 키가 설정되지 않았습니다. wrangler secret put CODEF_CLIENT_ID / CODEF_CLIENT_SECRET', 'proxy_no_keys');
  }
  const key = id + '|' + secret;
  const now = Date.now();
  if (tokenCache.token && tokenCache.key === key && tokenCache.exp > now + 60000) {
    return tokenCache.token;
  }
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(id + ':' + secret)
    },
    body: 'grant_type=client_credentials&scope=read'
  });
  const text = await res.text();
  let data = decodeBody(text);
  if (!res.ok || !data.access_token) {
    throw httpError(502,
      'CODEF 토큰 발급 실패 (HTTP ' + res.status + ') ' + (data.error_description || data.error || ''),
      'proxy_token_failed');
  }
  tokenCache = {
    key: key,
    token: data.access_token,
    exp: now + (Number(data.expires_in) || 604800) * 1000
  };
  return tokenCache.token;
}

async function callCodef(env, path, params) {
  const baseKey = env.CODEF_ENV === 'api' ? 'api' : 'demo';
  const token = await getToken(env);
  const timeout = Number(env.CODEF_TIMEOUT_MS) || 30000;
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, timeout);
  let res;
  try {
    res = await fetch(BASE_URL[baseKey] + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: encodeURIComponent(JSON.stringify(params)),
      signal: ctl.signal
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message)));
    throw httpError(504, aborted
      ? 'CODEF 응답 시간이 초과되었습니다(' + Math.round(timeout / 1000) + '초). 간편인증을 마친 뒤 다시 시도해 주세요.'
      : 'CODEF에 연결하지 못했습니다: ' + (e && e.message ? e.message : e), 'proxy_upstream');
  }
  clearTimeout(timer);
  const text = await res.text();
  return { status: res.status, body: decodeBody(text) };
}

/* ------------------------------------------------------- 요청 파라미터 */

function buildProfile(input) {
  const name = String((input && input.name) || '').trim();
  const birth = digits(input && input.birth);
  const phone = digits(input && input.phone);
  const auth = String((input && input.auth) || 'kakao');
  const telecom = String((input && input.telecom) || '').toUpperCase();
  const address = String((input && input.address) || '').trim();

  if (name.length < 2) { throw httpError(400, '성명을 2자 이상 입력해 주세요.', 'input_name'); }
  if (birth.length !== 8) { throw httpError(400, '생년월일 8자리(YYYYMMDD)를 입력해 주세요.', 'input_birth'); }
  if (phone.length < 10 || phone.length > 11) { throw httpError(400, '휴대폰 번호를 숫자로 입력해 주세요.', 'input_phone'); }
  if (!AUTH_LEVEL[auth]) { throw httpError(400, '간편인증 수단을 골라 주세요(카카오톡·네이버·PASS·토스).', 'input_auth'); }
  if (telecom && !TELECOM_CODE[telecom]) { throw httpError(400, '통신사는 SKT·KT·LGU+ 중에서 골라 주세요.', 'input_telecom'); }

  return { name: name, birth: birth, phone: phone, auth: auth, telecom: telecom, address: address };
}

function buildParams(docId, profile) {
  const p = PRODUCTS[docId];
  if (!p) { throw httpError(400, '지원하지 않는 서류입니다: ' + docId, 'unknown_doc'); }
  if (p.requiresAddress && !profile.address) {
    throw httpError(400, p.label + ' 조회에는 주소가 필요합니다. 주소를 입력해 주세요.', 'input_address');
  }
  const params = {
    organization: p.organization,
    loginType: '5',
    loginTypeLevel: AUTH_LEVEL[profile.auth],
    userName: profile.name,
    phoneNo: profile.phone
  };
  if (profile.telecom) { params.telecom = TELECOM_CODE[profile.telecom]; }
  if (p.identity === 'birth') { params.identity = profile.birth; }
  if (p.requiresAddress) { params.address = profile.address; }
  Object.keys(p.defaults).forEach(function (k) { params[k] = p.defaults[k]; });
  return params;
}

/* ------------------------------------------------------------ 정규화 */

function asList(v) { return Array.isArray(v) ? v : (v ? [v] : []); }

function pickCurrentInsurance(records) {
  const list = asList(records).filter(Boolean);
  if (!list.length) { return null; }
  const ongoing = list.filter(function (r) { return !r.commEndDate; });
  const pool = ongoing.length ? ongoing : list;
  return pool.slice().sort(function (a, b) {
    return String(b.commStartDate || '').localeCompare(String(a.commStartDate || ''));
  })[0];
}

function normalize(docId, body) {
  const data = body && body.data;
  if (!data) { return null; }
  if (docId === 'insurance') {
    const cur = pickCurrentInsurance(data);
    if (!cur) { return null; }
    const joinType = String(cur.resJoinUserType || '');
    return {
      kind: 'insurance',
      name: cur.resUserNm || '',
      maskedRrn: maskRrn(cur.resUserIdentiyNo),
      issueNo: cur.resIssueNo || '',
      issueDate: cur.resIssueDate || '',
      joinType: joinType,
      company: cur.resCompanyNm || '',
      startDate: cur.commStartDate || '',
      endDate: cur.commEndDate || '',
      history: asList(data).map(function (r) {
        return { joinType: r.resJoinUserType || '', company: r.resCompanyNm || '', start: r.commStartDate || '', end: r.commEndDate || '' };
      }),
      /* 미취업 확인: 직장가입자이면서 상실일이 없으면 '취업'으로 본다. */
      employed: /직장가입자/.test(joinType) && !cur.commEndDate
    };
  }
  if (docId === 'resident') {
    const addrList = asList(data.resAddrHisSummaryList);
    const members = asList(data.resCompositionList).map(function (m) {
      return { name: m.resUserNm || '', relation: m.resRelationWithHH || '', status: m.resRegistrationStatus || '' };
    });
    return {
      kind: 'resident',
      docNo: data.resDocNo || '',
      name: data.resSubscriber || '',
      birth: digits(data.commBirthDate),
      reportedDate: data.resReportingDate || '',
      hhName: data.resHHName || '',
      compositionReason: data.resCompositionReason || '',
      compositionDate: data.resCompositionDate || '',
      issueOrg: data.resIssueOgzNm || '',
      address: addrList.length ? (addrList[0].resUserAddr || '') : '',
      members: members
    };
  }
  if (docId === 'disability') {
    return {
      kind: 'disability',
      docNo: data.resDocNo || '',
      issueNo: data.resIssueNo || '',
      name: data.resUserNm || '',
      maskedRrn: maskRrn(data.resUserIdentiyNo),
      address: data.resUserAddr || '',
      main: data.resMainDisability || '',
      sub: data.resSubDisability || '',
      regNumber: data.resRegNumber || '',
      firstDate: data.resFirstDate || '',
      registerDate: data.resRegisterDate || '',
      multiple: data.resMultipleDisability || '',
      issueDate: data.resIssueDate || '',
      issueOrg: data.resIssueOgzNm || ''
    };
  }
  return null;
}

/* --------------------------------------------------------- 모의 응답 */

function mockResult(docId) {
  const now = new Date();
  const ymd = function (d) { return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
  const base = {
    result: { code: 'CF-00000', message: '성공(모의 응답)', extraMessage: '' },
    data: {}
  };
  if (docId === 'insurance') {
    base.data = {
      resUserNm: '김다온', resUserIdentiyNo: '9901011******', resIssueNo: 'G' + ymd(now) + '0000001',
      resIssueDate: ymd(now), resJoinUserType: '지역가입자', resCompanyNm: '', commStartDate: '20180101', commEndDate: ''
    };
  } else if (docId === 'resident') {
    base.data = {
      resDocNo: '0000-0000-0000-0001', resSubscriber: '김다온', commBirthDate: '19990101',
      resReportingDate: ymd(now), resHHName: '김다온', resCompositionReason: '세대분리',
      resCompositionDate: '20240102', resIssueOgzNm: '경상남도 진주시장',
      resAddrHisSummaryList: [{ resNumber: '현주소: ', resUserAddr: '경상남도 진주시 예시로 12 (가상주소)', resMoveInDate: '20240102', resChangeDate: '20240102', resChangeReason: '전입' }],
      resCompositionList: [{ resNumber: '1', resRelationWithHH: '본인', resUserNm: '김다온', resUserIdentiyNo: '9901011******', resRegistrationStatus: '거주자' }],
      resAddrChangeList: []
    };
  } else if (docId === 'disability') {
    base.data = {
      resDocNo: '0000-0000-0000-0002', resIssueNo: 'D' + ymd(now) + '0000002', resUserNm: '김다온',
      resUserIdentiyNo: '9901011******', resUserAddr: '경상남도 진주시 예시로 12 (가상주소)',
      resMainDisability: '지체장애 / 심한 장애', resSubDisability: '', resRegNumber: '00-000000',
      resFirstDate: '20200101', resRegisterDate: '20200101', resMultipleDisability: '심한 장애',
      resIssueDate: ymd(now), resIssueOgzNm: '경상남도 진주시장'
    };
  }
  return base;
}

/* ------------------------------------------------------------ 핸들러 */

async function handleHealth(env, request) {
  const configured = !!(env.CODEF_CLIENT_ID && env.CODEF_CLIENT_SECRET);
  const mock = env.CODEF_MOCK === '1';
  return jsonResponse({
    ok: true,
    service: 'daon-codef-proxy',
    version: '1.0.0',
    env: env.CODEF_ENV === 'api' ? 'api' : 'demo',
    configured: configured,
    mock: mock,
    authRequired: !!env.PROXY_TOKEN,
    checkedAt: new Date().toISOString(),
    products: Object.keys(PRODUCTS).map(function (k) {
      return { id: k, label: PRODUCTS[k].label, agency: PRODUCTS[k].agency };
    }),
    note: mock ? 'CODEF_MOCK=1 — 실제 기관 조회가 아닌 모의 응답입니다.' : ''
  }, 200, env, request);
}

async function handleRequest(env, request) {
  const body = await readJson(request);
  const docId = String(body.docId || '');
  const profile = buildProfile(body.profile || {});
  const params = buildParams(docId, profile);
  if (body.id) { params.id = String(body.id); }

  if (env.CODEF_MOCK === '1') {
    return jsonResponse({
      ok: true, mock: true, status: 'twoWay', doc: docId, agency: PRODUCTS[docId].agency,
      method: 'simpleAuth',
      twoWayInfo: { jobIndex: 0, threadIndex: 0, jti: 'mock-' + Date.now(), twoWayTimestamp: Date.now() },
      timeoutSeconds: 270,
      result: { code: 'CF-03002', message: '모의 응답: 간편인증 요청' }
    }, 200, env, request);
  }

  const out = await callCodef(env, PRODUCTS[docId].path, params);
  const r = (out.body && out.body.result) || {};
  const d = (out.body && out.body.data) || {};
  const code = String(r.code || '');

  if (code === 'CF-03002' || d.continue2Way === true) {
    return jsonResponse({
      ok: true,
      status: 'twoWay',
      doc: docId,
      agency: PRODUCTS[docId].agency,
      method: d.method || '',
      twoWayInfo: {
        jobIndex: d.jobIndex,
        threadIndex: d.threadIndex,
        jti: d.jti,
        twoWayTimestamp: d.twoWayTimestamp
      },
      timeoutSeconds: 270,
      result: { code: code, message: r.message || '' }
    }, 200, env, request);
  }

  if (code === 'CF-00000') {
    return jsonResponse({
      ok: true, status: 'done', doc: docId, agency: PRODUCTS[docId].agency,
      result: { code: code, message: r.message || '' },
      normalized: normalize(docId, out.body)
    }, 200, env, request);
  }

  /* 그 밖의 코드는 숨기지 않고 그대로 전달한다. */
  return jsonResponse({
    ok: false,
    status: 'error',
    doc: docId,
    code: code || 'CF-UNKNOWN',
    message: r.message || r.extraMessage || '기관 조회에 실패했습니다.',
    result: { code: code, message: r.message || '', extraMessage: r.extraMessage || '' }
  }, 200, env, request);
}

async function handleComplete(env, request) {
  const body = await readJson(request);
  const docId = String(body.docId || '');
  const info = body.twoWayInfo || {};
  const required = ['jobIndex', 'threadIndex', 'jti', 'twoWayTimestamp'];
  const missing = required.filter(function (k) { return info[k] === undefined || info[k] === null || info[k] === ''; });
  if (missing.length) {
    throw httpError(400, '두 번째 요청에 필요한 인증 정보가 없습니다: ' + missing.join(', '), 'input_twoway');
  }
  const profile = buildProfile(body.profile || {});
  const params = buildParams(docId, profile);
  if (body.id) { params.id = String(body.id); }
  params.is2Way = true;
  params.simpleAuth = '1';
  params.twoWayInfo = {
    jobIndex: info.jobIndex,
    threadIndex: info.threadIndex,
    jti: info.jti,
    twoWayTimestamp: info.twoWayTimestamp
  };

  if (env.CODEF_MOCK === '1') {
    const mock = mockResult(docId);
    return jsonResponse({
      ok: true, mock: true, status: 'done', doc: docId, agency: PRODUCTS[docId].agency,
      result: { code: 'CF-00000', message: mock.result.message },
      normalized: normalize(docId, mock)
    }, 200, env, request);
  }

  const out = await callCodef(env, PRODUCTS[docId].path, params);
  const r = (out.body && out.body.result) || {};
  const d = (out.body && out.body.data) || {};
  const code = String(r.code || '');

  if (code === 'CF-03002') {
    /* 인증이 아직 끝나지 않음. simpleAuth "1"을 반복하면 3번째에 CF-12872가 난다. */
    return jsonResponse({
      ok: true,
      status: 'twoWay',
      doc: docId,
      agency: PRODUCTS[docId].agency,
      method: d.method || '',
      twoWayInfo: {
        jobIndex: d.jobIndex,
        threadIndex: d.threadIndex,
        jti: d.jti,
        twoWayTimestamp: d.twoWayTimestamp
      },
      timeoutSeconds: 270,
      result: { code: code, message: r.message || '인증이 아직 완료되지 않았습니다.' }
    }, 200, env, request);
  }
  if (code === 'CF-00000') {
    return jsonResponse({
      ok: true, status: 'done', doc: docId, agency: PRODUCTS[docId].agency,
      result: { code: code, message: r.message || '' },
      normalized: normalize(docId, out.body)
    }, 200, env, request);
  }
  return jsonResponse({
    ok: false,
    status: 'error',
    doc: docId,
    code: code || 'CF-UNKNOWN',
    message: r.message || r.extraMessage || '기관 조회에 실패했습니다.',
    result: { code: code, message: r.message || '', extraMessage: r.extraMessage || '' }
  }, 200, env, request);
}

async function readJson(request) {
  const text = await request.text();
  if (!text) { return {}; }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw httpError(400, '요청 본문이 JSON이 아닙니다.', 'bad_json');
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) });
    }
    if (!allowed(request, env)) {
      return jsonResponse({ ok: false, error: 'proxy_token', message: '접속 토큰이 맞지 않습니다.' }, 401, env, request);
    }

    try {
      if (url.pathname === '/api/health' && (method === 'GET' || method === 'POST')) {
        return await handleHealth(env, request);
      }
      if (url.pathname === '/api/auth/request' && method === 'POST') {
        return await handleRequest(env, request);
      }
      if (url.pathname === '/api/auth/complete' && method === 'POST') {
        return await handleComplete(env, request);
      }
      return jsonResponse({
        ok: false,
        error: 'not_found',
        message: '없는 주소입니다. /api/health · /api/auth/request · /api/auth/complete 만 열려 있습니다.'
      }, 404, env, request);
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      return jsonResponse({
        ok: false,
        error: e && e.code ? e.code : 'proxy_error',
        message: e && e.message ? e.message : '프록시 오류가 발생했습니다.'
      }, status, env, request);
    }
  }
};
