"""Contact sheet out/v13-review.jpg: reference | v12 | v13 triples (two per row), labelled; new v13 views have no v12 cell."""
from pathlib import Path

from PIL import Image, ImageDraw

T = Path(__file__).resolve().parent
O, R = T / 'out', T / 'references' / 'v12'
V12 = lambda k: O / f'v12_{k}.png'  # noqa: E731
V13 = lambda k: O / f'v13_{k}.png'  # noqa: E731
TR = [  # (reference or None, label, v12 or None, v13, label)
    (R / '01-seoul-grid-skyline.png', 'ref 01 Seoul grid', V12('a_start_straight'), V13('a_start_straight'), 'start straight, driver height'),
    (None, '', V12('f_stand_clearance'), V13('f_stand_clearance'), 'stand clearance view'),
    (R / '02-jeddah-aerial-lagoon.webp', 'ref 02 Jeddah lagoon', V12('b_lagoon_aerial'), V13('b_lagoon_aerial'), 'lagoon aerial + village'),
    (R / '03-jeddah-runoff-wheel.webp', 'ref 03 run-off + wheel', V12('c_corner_runoff_wheel'), V13('c_corner_runoff_wheel'), 'corner, wide run-off'),
    (R / '04-tokyo-street-fuji.webp', 'ref 04 street, pagoda, Fuji', V12('d_street_pagoda_fuji'), V13('d_street_pagoda_fuji'), 'street, pagoda'),
    (R / '10-own-neon-street-fuji.webp', 'ref 10 own neon street', V12('i_neon_street_fuji'), V13('i_neon_street_fuji'), 'neon street (same camera)'),
    (R / '11-own-ferris-wheel.webp', 'ref 11 own Ferris wheel', V12('h_ferris_wheel'), V13('h_ferris_wheel'), 'Ferris wheel (same camera)'),
    (R / '13-own-bridge-red-night.webp', 'ref 13 own bridge', V12('j_bridge_night'), V13('j_bridge_night'), 'bridge (same camera)'),
    (R / '06-own-tunnel-bridge.webp', 'ref 06 own tunnel', V12('g_tunnel_bridge'), V13('g_tunnel_bridge'), 'tunnel approach'),
    (R / '07-himeji-castle-eaves.png', 'ref 07 Himeji castle', V12('k_castle'), V13('k_castle'), 'castle'),
    (R / '08-flowing-white-hq.png', 'ref 08 flowing white HQ', V12('l_flowing_hq'), V13('s_hq_aerial'), 'HQ across the straight (aerial)'),
    (R / '12-lantern-hall.png', 'ref 12 lantern hall', V12('m_lantern_hall'), V13('t_lantern_hall'), 'lantern hall (moved)'),
    (R / '05-neon-gate.png', 'ref 05 neon gate', V12('e_gate'), V13('v_neon_gate'), 'neon gate (moved)'),
    (R / '09-heian-vermilion-gate.webp', 'ref 09 Heian gate', None, V13('e_gate'), 'Asakusa gate'),
    (None, '', None, V13('n_hq_from_start'), 'NEW: HQ seen from the start straight'),
    (None, '', None, V13('o_pano_driver_start'), 'NEW: low skyline, driver height'),
    (None, '', None, V13('p_bridge_deck_closeup'), 'NEW: bridge deck, nothing over the lanes'),
    (None, '', None, V13('q_tunnel_murals'), 'NEW: tunnel, tiles, fans, mural panels'),
    (None, '', None, V13('u_timber_tower'), 'NEW: timber tower (moved)'),
] + [(None, '', None, V13(f'r{n}_holo_anchor'), f'NEW: HOLO_anchor_{n:02d} marker') for n in range(1, 7)]
CW, CH, LAB = 512, 288, 22


def cell(path, label):
    c = Image.new('RGB', (CW, CH + LAB), (12, 12, 16))
    d = ImageDraw.Draw(c)
    if path is not None and Path(path).exists():
        im = Image.open(path).convert('RGB')
        s = min(CW / im.width, CH / im.height)
        im = im.resize((int(im.width * s), int(im.height * s)))
        c.paste(im, ((CW - im.width) // 2, LAB + (CH - im.height) // 2))
    d.text((6, 6), label, fill=(255, 255, 255))
    return c


rows = (len(TR) + 1) // 2
sheet = Image.new('RGB', (CW * 6, (CH + LAB) * rows), (0, 0, 0))
for k, (ref, lr, a, b, lb) in enumerate(TR):
    x, y = (k % 2) * CW * 3, (k // 2) * (CH + LAB)
    sheet.paste(cell(ref, lr), (x, y))
    sheet.paste(cell(a, 'v12' if a else 'v12: (no equivalent view)'), (x + CW, y))
    sheet.paste(cell(b, 'v13  ' + lb), (x + 2 * CW, y))
sheet.save(O / 'v13-review.jpg', quality=88)
print('saved', sheet.size)
