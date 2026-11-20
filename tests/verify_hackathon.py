#!/usr/bin/env python3
"""다온 헬스케어 (hackathon 브랜치) 자동 검증.

    pip install playwright && playwright install chromium
    python3 tests/verify_hackathon.py                          # 로컬 index.html
    python3 tests/verify_hackathon.py http://localhost:8000/ out/

확인하는 것
  · 콘솔 에러 0건 / 375px·1280px 가로 넘침 없음
  · 첫 실행 안전 안내 → 닫힘, 안전 고지 줄 표시
  · 채팅 인사·브리핑·빠른 질문, 복약 질문 답변 + 약 카드
  · 응급 문구 → 119 안내 + "판단하지 않아요"
  · 약 체크 → 진행 수 증가, 약봉투 예시 → 확인 → 일정에 약 추가
  · 안부 전화 연결 → 답변 → 정리 카드(DAON-CALL)
  · 받을 소식 5개, 소식 끄면 알림이 줄어듦
  · 큰 글씨·고대비 넘침 없음, 안전 안내 시트
성공하면 마지막 줄에 "ALL PASS"를 출력하고 종료 코드 0, 실패가 있으면 1.
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
URL = sys.argv[1] if len(sys.argv) > 1 else "file://" + os.path.join(ROOT, "index.html")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "hackathon-shots")
os.makedirs(OUT, exist_ok=True)

report = {"url": URL, "checks": [], "console_errors": [], "shots": []}


def check(name, ok, extra=None):
    report["checks"].append({"name": name, "ok": bool(ok), "extra": extra})


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        errs = []

        # ---------- 모바일 375 ----------
        ctx = b.new_context(viewport={"width": 375, "height": 812}, device_scale_factor=2,
                            is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
        pg.on("console", lambda m: errs.append("CONSOLE %s: %s" % (m.type, m.text)) if m.type == "error" else None)
        pg.goto(URL)
        pg.wait_for_timeout(800)

        def overflow(page=None):
            page = page or pg
            return page.evaluate("() => { const d=document.documentElement; return {sw:d.scrollWidth, cw:d.clientWidth}; }")

        def shot(page, name):
            path = os.path.join(OUT, name)
            page.screenshot(path=path)
            report["shots"].append(path)

        check("첫 화면 제목", "다온 헬스케어" in pg.title(), pg.title())
        check("안전 안내 모달이 먼저 뜬다", pg.is_visible("#welcome"))
        shot(pg, "00-welcome-375.png")
        pg.click("#btnWelcomeOk")
        pg.wait_for_timeout(400)
        check("안전 안내 닫힘", not pg.is_visible("#welcome"))
        check("안전 고지 줄 항상 보임", pg.is_visible(".safebar"))

        o = overflow()
        check("375 첫 화면 가로 넘침 없음", o["sw"] <= 376, o)
        check("첫 화면 = 다온 채팅", pg.is_visible("#view-chat") and not pg.is_visible("#view-meds"))
        check("인사 말풍선 있음", pg.locator("#chatLog .msg").count() >= 1, pg.locator("#chatLog .msg").count())
        check("오늘 브리핑 카드", pg.locator("#chatBrief .briefcard").count() == 1)
        check("빠른 질문 5개", pg.locator("#chatLog .qchip").count() >= 5, pg.locator("#chatLog .qchip").count())
        shot(pg, "01-chat-375.png")

        # 채팅 — 복약 질문
        pg.fill("#chatInput", "오늘 먹을 약 알려줘")
        pg.click("#chatSend")
        pg.wait_for_timeout(500)
        txt = pg.inner_text("#chatLog")
        check("복약 답변에 오늘 복약 횟수", "오늘 드실 약은 모두" in txt)
        check("약 목록 카드", pg.locator("#chatLog .chipcard").count() >= 1)
        o = overflow()
        check("채팅 답변 뒤 가로 넘침 없음", o["sw"] <= 376, o)
        shot(pg, "02-chat-meds-375.png")

        # 채팅 — 응급 안전 답변
        pg.fill("#chatInput", "가슴이 아파요")
        pg.click("#chatSend")
        pg.wait_for_timeout(400)
        txt = pg.inner_text("#chatLog")
        check("응급 표현에 119 안내", "119" in txt)
        check("진단하지 않는다는 고지", "판단하지 않아요" in txt)

        # 오늘의 약
        pg.click('#modeBar [data-mode="meds"]')
        pg.wait_for_timeout(400)
        o = overflow()
        check("약 화면 가로 넘침 없음", o["sw"] <= 376, o)
        check("복약 진행 카드", pg.locator("#medProgress .kpi").count() == 1)
        before = pg.inner_text("#medProgress .kpi b")
        check("오늘 약 체크 버튼 있음", pg.locator("#medSlots [data-take]").count() >= 4)
        pg.locator("#medSlots .medrow:not(.on) [data-take]").first.click()
        pg.wait_for_timeout(400)
        after = pg.inner_text("#medProgress .kpi b")
        check("약 체크하면 진행 수가 는다", int(after) == int(before) + 1, (before, after))
        shot(pg, "03-meds-375.png")

        # 약봉투 OCR (예시)
        meds_before = pg.locator("#medSlots [data-take]").count()
        pg.click("#btnBagSample")
        pg.wait_for_timeout(400)
        check("약봉투 시트 열림", pg.is_visible("#ocr"))
        shot(pg, "04-ocr-pick-375.png")
        pg.click('#ocrBody [data-ocr="sample"]')
        pg.wait_for_timeout(500)
        shot(pg, "05-ocr-reading-375.png")
        pg.wait_for_timeout(2400)
        check("인식 결과 확인 단계", pg.locator('#ocrBody [data-ocr-pick]').count() >= 1,
              pg.locator('#ocrBody [data-ocr-pick]').count())
        shot(pg, "06-ocr-review-375.png")
        pg.click('#ocrBody [data-ocr="add"]')
        pg.wait_for_timeout(700)
        check("약봉투 시트 닫힘", not pg.is_visible("#ocr"))
        check("약 화면으로 이동", pg.is_visible("#view-meds"))
        meds_after = pg.locator("#medSlots [data-take]").count()
        check("약봉투에서 약이 일정에 더해진다", meds_after > meds_before, (meds_before, meds_after))
        shot(pg, "06b-meds-added-375.png")

        # 안부 전화
        pg.click('#modeBar [data-mode="call"]')
        pg.wait_for_timeout(400)
        check("전화 시나리오 3개", pg.locator("#callScn [data-call]").count() == 3,
              pg.locator("#callScn [data-call]").count())
        shot(pg, "07-call-idle-375.png")
        pg.click('#callScn [data-call="med"]')
        pg.wait_for_timeout(2200)
        check("통화 연결됨", "통화 중" in pg.inner_text("#callCard"))
        pg.wait_for_timeout(3200)
        check("답변 칩 나옴", pg.locator('#callOpts [data-answer]').count() >= 2,
              pg.locator('#callOpts [data-answer]').count())
        shot(pg, "08-call-live-375.png")
        pg.locator('#callOpts [data-answer]').first.click()
        pg.wait_for_timeout(600)
        deadline = time.time() + 45
        while time.time() < deadline:
            if pg.locator("#callSummary .sumcard").count():
                break
            if pg.locator('#callOpts [data-answer]').count():
                pg.locator('#callOpts [data-answer]').first.click()
            pg.wait_for_timeout(700)
        check("통화 정리 카드", pg.locator("#callSummary .sumcard").count() == 1)
        if pg.locator("#callSummary .sumcard").count():
            check("통화 정리 번호", "DAON-CALL" in pg.inner_text("#callSummary"))
        o = overflow()
        check("통화 화면 가로 넘침 없음", o["sw"] <= 376, o)
        pg.evaluate("() => document.querySelector('#callSummary').scrollIntoView({block:'center'})")
        pg.wait_for_timeout(300)
        shot(pg, "09-call-summary-375.png")

        # 통화 중에 다른 탭으로 옮겨도 멈춘 화면이 남지 않는다 (정리 카드가 생긴다)
        pg.click('#callSummary [data-call-new]')
        pg.wait_for_timeout(400)
        pg.click('#callScn [data-call="mood"]')
        pg.wait_for_timeout(2600)
        pg.click('#modeBar [data-mode="chat"]')
        pg.wait_for_timeout(500)
        pg.click('#modeBar [data-mode="call"]')
        pg.wait_for_timeout(500)
        check("통화 중 화면을 옮겨도 정리 카드가 남는다", pg.locator("#callSummary .sumcard").count() == 1)
        check("멈춘 '통화 중' 화면이 남지 않는다", "통화 중" not in pg.inner_text("#callCard"))

        # 예시 인물 바꾸기
        pg.click('#modeBar [data-mode="meds"]')
        pg.wait_for_timeout(400)
        pg.click('#medPerson [data-act="person"]')
        pg.wait_for_timeout(400)
        pg.click('#sheetBody [data-person="youngsu"]')
        pg.wait_for_timeout(500)
        check("예시 인물을 바꾸면 그 사람 약으로 바뀐다", "김영수" in pg.inner_text("#medPerson"))
        pg.click('#medPerson [data-act="person"]')
        pg.wait_for_timeout(300)
        pg.click('#sheetBody [data-person="soonja"]')
        pg.wait_for_timeout(400)

        # 맞춤 알림
        pg.click('#modeBar [data-mode="notify"]')
        pg.wait_for_timeout(500)
        o = overflow()
        check("알림 화면 가로 넘침 없음", o["sw"] <= 376, o)
        check("받을 소식 5개", pg.locator("#subList [data-sub]").count() == 5)
        rows = pg.locator("#alertList .alertrow").count()
        check("알림 센터 항목 있음", rows >= 4, rows)
        pg.locator("#alertList .alertrow").first.click()
        pg.wait_for_timeout(300)
        shot(pg, "10-notify-375.png")
        pg.locator('#subList [data-sub="care"]').uncheck()
        pg.wait_for_timeout(400)
        rows2 = pg.locator("#alertList .alertrow").count()
        check("소식 끄면 그 알림이 사라진다", rows2 < rows, (rows, rows2))
        pg.locator('#subList [data-sub="care"]').check()
        pg.wait_for_timeout(300)

        # 큰 글씨 · 고대비
        pg.click("#btnBigText")
        pg.wait_for_timeout(400)
        o = overflow()
        check("큰 글씨 375 넘침 없음", o["sw"] <= 376, o)
        shot(pg, "11-notify-big-375.png")
        pg.click("#btnBigText")
        pg.click("#btnHighContrast")
        pg.wait_for_timeout(300)
        o = overflow()
        check("고대비 375 넘침 없음", o["sw"] <= 376, o)
        pg.click('#modeBar [data-mode="meds"]')
        pg.wait_for_timeout(300)
        shot(pg, "12-meds-contrast-375.png")
        pg.click("#btnHighContrast")
        pg.wait_for_timeout(200)

        # 안전 안내 시트
        pg.click("#btnGuide")
        pg.wait_for_timeout(300)
        check("안전 안내 시트", pg.is_visible("#sheet"))
        shot(pg, "13-guide-375.png")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(200)

        # ---------- 데스크톱 1280 ----------
        ctx2 = b.new_context(viewport={"width": 1280, "height": 900})
        pg2 = ctx2.new_page()
        pg2.on("pageerror", lambda e: errs.append("PAGEERROR(1280): " + str(e)))
        pg2.on("console", lambda m: errs.append("CONSOLE(1280) %s: %s" % (m.type, m.text)) if m.type == "error" else None)
        pg2.goto(URL)
        pg2.wait_for_timeout(800)
        if pg2.is_visible("#welcome"):
            pg2.click("#btnWelcomeOk")
            pg2.wait_for_timeout(300)
        o2 = overflow(pg2)
        check("1280 가로 넘침 없음", o2["sw"] <= o2["cw"] + 1, o2)
        shot(pg2, "14-chat-1280.png")
        pg2.click('#modeBar [data-mode="meds"]')
        pg2.wait_for_timeout(400)
        o2 = overflow(pg2)
        check("1280 약 화면 넘침 없음", o2["sw"] <= o2["cw"] + 1, o2)
        shot(pg2, "15-meds-1280.png")

        report["console_errors"] = [e for e in errs if "favicon" not in e]
        b.close()


if __name__ == "__main__":
    run()
    bad = [c for c in report["checks"] if not c["ok"]]
    print(json.dumps(report, ensure_ascii=False, indent=1))
    print("\n%d개 확인 · 실패 %d개" % (len(report["checks"]), len(bad)))
    for c in bad:
        print("  FAIL:", c["name"], c["extra"])
    if report["console_errors"]:
        print("  콘솔 에러:", report["console_errors"])
    print("ALL PASS" if not bad and not report["console_errors"] else "FAILED")
    sys.exit(0 if not bad and not report["console_errors"] else 1)
