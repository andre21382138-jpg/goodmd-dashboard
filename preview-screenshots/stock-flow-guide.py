"""매장↔본사 발주 흐름 안내 이미지 생성 — PNG 출력"""
from PIL import Image, ImageDraw, ImageFont

# 캔버스
W, H = 1200, 1700
BG = (250, 248, 245)
img = Image.new('RGB', (W, H), BG)
draw = ImageDraw.Draw(img)

# 폰트 (Windows 맑은 고딕)
FONT_PATH = 'C:/Windows/Fonts/malgun.ttf'
FONT_PATH_BOLD = 'C:/Windows/Fonts/malgunbd.ttf'

def F(size, bold=False):
    return ImageFont.truetype(FONT_PATH_BOLD if bold else FONT_PATH, size)

# 컬러 팔레트
COL_STORE = (230, 81, 0)
COL_STORE_BG = (255, 243, 224)
COL_HQ    = (106, 27, 154)
COL_HQ_BG = (243, 229, 245)
COL_OK    = (46, 125, 50)
COL_OK_BG = (232, 245, 233)
COL_PEND  = (230, 81, 0)
COL_PEND_BG = (255, 243, 224)
COL_BORDER = (200, 200, 200)
COL_TEXT  = (50, 50, 50)
COL_TEXT2 = (100, 100, 100)
COL_ARROW = (130, 130, 130)

# 타이틀
draw.text((W//2, 50), '매장 - 본사 발주 흐름', font=F(38, True), fill=COL_TEXT, anchor='mm')
draw.text((W//2, 100), '재고요청 -> 발주진행 -> 입고확인 (5단계)', font=F(20), fill=COL_TEXT2, anchor='mm')

def step_box(y, who, who_color, who_bg, title, desc, menu, status_text, status_color, status_bg):
    pad = 60
    bx = pad
    bw = W - pad*2
    bh = 230
    draw.rounded_rectangle([bx, y, bx+bw, y+bh], radius=18, fill='white', outline=COL_BORDER, width=2)
    # 좌측 사용자 뱃지
    draw.rounded_rectangle([bx+24, y+24, bx+200, y+74], radius=10, fill=who_bg, outline=who_color, width=2)
    draw.text((bx+112, y+49), who, font=F(22, True), fill=who_color, anchor='mm')
    # 제목
    draw.text((bx+220, y+38), title, font=F(28, True), fill=COL_TEXT, anchor='lm')
    # 메뉴 경로
    draw.text((bx+220, y+72), menu, font=F(17), fill=COL_TEXT2, anchor='lm')
    # 설명
    line_y = y+118
    for line in desc:
        draw.text((bx+30, line_y), line, font=F(19), fill=COL_TEXT, anchor='lm')
        line_y += 32
    # 우측 상태 뱃지
    if status_text:
        bw2 = 240
        bx2 = bx + bw - bw2 - 30
        by2 = y + bh - 70
        draw.rounded_rectangle([bx2, by2, bx2+bw2, by2+50], radius=12, fill=status_bg, outline=status_color, width=2)
        draw.text((bx2+bw2//2, by2+25), status_text, font=F(20, True), fill=status_color, anchor='mm')

def arrow(y):
    cx = W // 2
    draw.polygon([(cx-22, y), (cx+22, y), (cx, y+30)], fill=COL_ARROW)

# 단계들
y = 150
step_box(y, '매장', COL_STORE, COL_STORE_BG,
         '1. 발주요청',
         ['- 상품 / 수량 입력 후 [재고 요청] 클릭',
          '- 요청 이력에 새 행이 추가됨'],
         '재고관리 > 발주요청',
         '● 요청대기', COL_PEND, COL_PEND_BG)
y += 250
arrow(y); y += 45

step_box(y, '본사', COL_HQ, COL_HQ_BG,
         '2. 매장 요청 확인 & 수량 조정',
         ['- 매장 그룹 펼침 -> 라인별 수량 수정 가능',
          '- 예: 매장 20개 요청 -> 본사 10개만 가능 -> 10으로 저장'],
         '재고관리 > 발주진행 > [매장 재고요청] 탭',
         '', None, None)
y += 250
arrow(y); y += 45

step_box(y, '본사', COL_HQ, COL_HQ_BG,
         '3. 선택 후 발주진행',
         ['- 처리할 라인 체크박스 선택',
          '- 상단 [발주진행] 클릭 -> 자동으로 [매장 발주완료] 탭으로'],
         '재고관리 > 발주진행 > [매장 재고요청] 탭',
         '● 발주진행중', COL_HQ, COL_HQ_BG)
y += 250
arrow(y); y += 45

step_box(y, '매장', COL_STORE, COL_STORE_BG,
         '4. 입고확인',
         ['- 물건 도착 후 요청 이력 표에서 [입고확인] 클릭',
          '- 표에 표시된 수량은 본사가 실제로 보낸 수량'],
         '재고관리 > 발주요청',
         '', None, None)
y += 250
arrow(y); y += 45

step_box(y, '매장', COL_STORE, COL_STORE_BG,
         '5. 자동 처리 완료',
         ['- 매장재고에 자동으로 +수량 반영',
          '- 부족분(요청 - 실수령)은 필요시 다시 발주요청'],
         '재고관리 > 매장재고 에서 확인',
         '● 입고완료', COL_OK, COL_OK_BG)

# 푸터
y_foot = H - 60
draw.text((W//2, y_foot), '본사는 [매장 발주완료] 탭에서 진행 상태를 모니터링합니다',
          font=F(17), fill=COL_TEXT2, anchor='mm')

img.save('preview-screenshots/stock-flow-guide.png', 'PNG', optimize=True)
print('SAVED preview-screenshots/stock-flow-guide.png', img.size)
