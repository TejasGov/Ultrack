"""Contact sheet out/v12-review.jpg: references (or v10 'before' renders) left of the v12 render, labelled."""
from pathlib import Path
from PIL import Image, ImageDraw

T = Path(__file__).resolve().parent
O, R = T / 'out', T / 'references' / 'v12'
PAIRS = [   # (left image, left label, v12 image, label)
    (R / '01-seoul-grid-skyline.png', 'ref 01 Seoul grid', O / 'v12_a_start_straight.png', 'v12 (a) start straight, driver height'),
    (O / 'v10_before_a_start_straight.png', 'BEFORE: v10 start straight (EEVEE)', O / 'v12_a_start_straight.png', 'AFTER: v12 start straight'),
    (O / 'v10_before_f_stand_clearance.png', 'BEFORE: v10 stands over the road', O / 'v12_f_stand_clearance.png', 'AFTER: v12 (f) stand clearance view'),
    (R / '02-jeddah-aerial-lagoon.webp', 'ref 02 Jeddah lagoon', O / 'v12_b_lagoon_aerial.png', 'v12 (b) lagoon aerial'),
    (R / '03-jeddah-runoff-wheel.webp', 'ref 03 Jeddah run-off + wheel', O / 'v12_c_corner_runoff_wheel.png', 'v12 (c) corner, wheel'),
    (R / '04-tokyo-street-fuji.webp', 'ref 04 Tokyo street, pagoda, Fuji', O / 'v12_d_street_pagoda_fuji.png', 'v12 (d) street, pagoda, Fuji'),
    (R / '05-neon-gate.png', 'ref 05 neon gate', O / 'v12_e_gate.png', 'v12 (e) gate landmark'),
    (R / '06-own-tunnel-bridge.webp', 'ref 06 own tunnel + bridge', O / 'v12_g_tunnel_bridge.png', 'v12 tunnel approach'),
    (R / '10-own-neon-street-fuji.webp', 'ref 10 own neon street (v8)', O / 'v12_i_neon_street_fuji.png', 'v12 neon street, same camera'),
    (R / '11-own-ferris-wheel.webp', 'ref 11 own Ferris wheel (v6)', O / 'v12_h_ferris_wheel.png', 'v12 Ferris wheel, same camera'),
    (R / '13-own-bridge-red-night.webp', 'ref 13 own bridge (v5)', O / 'v12_j_bridge_night.png', 'v12 bridge, same camera'),
    (R / '07-himeji-castle-eaves.png', 'ref 07 Himeji castle', O / 'v12_k_castle.png', 'v12 castle on the infield hill'),
    (R / '08-flowing-white-hq.png', 'ref 08 flowing white HQ', O / 'v12_l_flowing_hq.png', 'v12 race HQ'),
    (R / '09-heian-vermilion-gate.webp', 'ref 09 Heian vermilion gate', O / 'v12_e_gate.png', 'v12 Asakusa north gate'),
    (R / '12-lantern-hall.png', 'ref 12 lantern hall', O / 'v12_m_lantern_hall.png', 'v12 lantern hall'),
]
CW, CH, LAB = 640, 360, 26


def cell(path, label):
    im = Image.open(path).convert('RGB')
    s = min(CW / im.width, CH / im.height)
    im = im.resize((int(im.width * s), int(im.height * s)))
    c = Image.new('RGB', (CW, CH + LAB), (12, 12, 16))
    c.paste(im, ((CW - im.width) // 2, LAB + (CH - im.height) // 2))
    ImageDraw.Draw(c).text((8, 7), label, fill=(255, 255, 255))
    return c


rows = (len(PAIRS) + 1) // 2
sheet = Image.new('RGB', (CW * 4, (CH + LAB) * rows), (0, 0, 0))
for k, (a, la, b, lb) in enumerate(PAIRS):
    x, y = (k % 2) * CW * 2, (k // 2) * (CH + LAB)
    sheet.paste(cell(a, la), (x, y))
    sheet.paste(cell(b, lb), (x + CW, y))
sheet.save(O / 'v12-review.jpg', quality=88)
print('saved', O / 'v12-review.jpg', sheet.size)
