"""
Playwright로 매장 매니저 화면 자동 캡처

테스트 계정: mall_test / 123456
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

# ===== 설정 =====
BASE_URL = 'https://goodmd-dashboard.vercel.app/'
USER_ID  = 'mall_test'
PASSWORD = '123456'

OUT_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')
os.makedirs(OUT_DIR, exist_ok=True)


HIDE_NOTIF_JS = """
() => {
  // 우측 하단 알림 popup 카드들의 부모 컨테이너 숨김
  const cards = document.querySelectorAll('.notif-card');
  cards.forEach(c => {
    let p = c.parentElement;
    while (p && p.tagName !== 'BODY') {
      const cs = getComputedStyle(p);
      if (cs.position === 'fixed') { p.style.display = 'none'; break; }
      p = p.parentElement;
    }
  });
  // 우측 하단 알림 종 버튼
  document.querySelectorAll('button[aria-label="알림"]').forEach(b => b.style.display = 'none');
}
"""


def shot(page, filename, full_page=False):
    """스크린샷 저장 + 알림 숨김 처리"""
    # 알림 popup, 종 버튼, 휴무 배너 모두 숨김
    page.evaluate(HIDE_NOTIF_JS)
    page.wait_for_timeout(150)
    path = os.path.join(OUT_DIR, filename)
    page.screenshot(path=path, full_page=full_page)
    size = os.path.getsize(path)
    print(f'  [OK] {filename} ({size:,} bytes)')


def login(page):
    print('Login...')
    page.goto(BASE_URL, wait_until='networkidle')
    # 아이디 input — 첫번째 text input
    page.fill('input[type="text"]', USER_ID)
    page.fill('input[type="password"]', PASSWORD)
    # 로그인 버튼 클릭
    page.click('button:has-text("로그인")')
    # 홈 로드 대기 (사이드바 노출 = home)
    page.wait_for_selector('.sidebar', timeout=20000)
    page.wait_for_timeout(1500)
    print('  Login OK')


def click_sidebar(page, label, sub_label=None):
    """사이드바 메뉴 클릭. sub_label이 있으면 flyout sub-item도 클릭."""
    print(f'-> {label}' + (f' > {sub_label}' if sub_label else ''))
    # 1) 부모 클릭
    parent = page.locator(f'.sidebar-item:has-text("{label}")').first
    parent.click()
    page.wait_for_timeout(800)
    # 2) sub 있으면 flyout에서 sub 클릭
    if sub_label:
        sub = page.locator(f'.sidebar-flyout-item:has-text("{sub_label}"), button:has-text("{sub_label}")').first
        # flyout이 안 보이면 다시 한번 부모 클릭으로 펼치기
        try:
            sub.wait_for(state='visible', timeout=2000)
        except Exception:
            parent.click()
            page.wait_for_timeout(500)
            sub.wait_for(state='visible', timeout=3000)
        sub.click()
        page.wait_for_timeout(1500)
    else:
        page.wait_for_timeout(1500)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': 1366, 'height': 768}, locale='ko-KR')
        page = ctx.new_page()

        # ========== 0) 로그인 ==========
        login(page)

        # ========== 1) 사이드바 캡처 (홈 진입 후 좌측 영역만) ==========
        print('Capture: sidebar (clock panel area)')
        page.evaluate(HIDE_NOTIF_JS)
        page.wait_for_timeout(150)
        sidebar_path = os.path.join(OUT_DIR, '02-sidebar.png')
        page.screenshot(path=sidebar_path, clip={'x': 0, 'y': 0, 'width': 240, 'height': 500})
        print(f'  [OK] 02-sidebar.png ({os.path.getsize(sidebar_path):,} bytes)')

        # ========== 2) 판매 입력 ==========
        click_sidebar(page, '판매 입력')
        shot(page, '03-sales-input.png')

        # ========== 3) 반품 접수 ==========
        click_sidebar(page, '반품 접수')
        shot(page, '04-sales-return.png')

        # ========== 4) 회원 관리 -> QR 가입 ==========
        click_sidebar(page, '회원 관리', 'QR 가입')
        shot(page, '05-customer-qr.png')

        # ========== 5) 회원 관리 -> 서류 가입 ==========
        click_sidebar(page, '회원 관리', '서류 가입')
        shot(page, '06-customer-doc.png')

        # ========== 6) 재고 관리 -> 재고 요청 ==========
        click_sidebar(page, '재고 관리', '재고 요청')
        shot(page, '07-stock-request.png')

        # ========== 7) 재고 관리 -> 발주 확인 -> 입고확인 탭 ==========
        click_sidebar(page, '재고 관리', '발주 확인')
        # 입고 확인 탭 클릭
        try:
            tab_btn = page.locator('button.tab:has-text("입고 확인")').first
            tab_btn.wait_for(timeout=3000)
            tab_btn.click()
            page.wait_for_timeout(1500)
        except Exception as e:
            print(f'  WARN: 입고 확인 탭 클릭 실패 — 발주 확인 탭으로 캡처 ({e})')
        shot(page, '08-purchase-receive.png')

        # ========== 8) 근태 관리 -> 휴무 신청 ==========
        click_sidebar(page, '근태 관리', '휴무 신청')
        shot(page, '09-leave-plan.png')

        # ========== 9) 보너스: 매장 재고 현황 ==========
        click_sidebar(page, '재고 관리', '재고 현황')
        shot(page, '10-store-stock.png')

        ctx.close()
        browser.close()

    print()
    print('All captures done.')
    print(f'Saved to: {OUT_DIR}')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
