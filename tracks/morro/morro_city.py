"""The city below the morro and the hills round the bay, exec'd by build_morro.py after morro_kit.py (needs its Sheet, window, KR streams, GW and LG).
Far detail only: what the hill's streets look down on at night. Blocks of four to fifteen floors on the flat (taller along the orla, as Rio's beach fronts), lit windows on the faces
that look at the hill or stand near a road, water tanks on the roofs, street lamps as points of orange; the other morros' houses as lit windows scattered up their slopes.
The streets' own frontages are morro_kit.py's; a block never stands on one (OCC)."""
CR = random.Random(57)
CS = Sheet('MN city', ['wplaster', 'gplaster', 'conc', 'yplaster', 'bplaster', 'glass', 'fibre', 'tank'])
def win_far(P, x, z, w, h):
    CS.face([P(x - w / 2, -0.03, z), P(x + w / 2, -0.03, z), P(x + w / 2, -0.03, z + h), P(x - w / 2, -0.03, z + h)], 'glass')
    if CR.random() < 0.38:
        cu, row = CR.randrange(8), (0 if CR.random() < 0.6 else 1); v0, v1 = (0.51, 0.99) if row == 0 else (0.01, 0.49)
        GW.face([P(x - w / 2, -0.045, z), P(x + w / 2, -0.045, z), P(x + w / 2, -0.045, z + h), P(x - w / 2, -0.045, z + h)], 'wglow', uv=[((cu + 0.02) / 8, v0), ((cu + 0.98) / 8, v0), ((cu + 0.98) / 8, v1), ((cu + 0.02) / 8, v1)])
HILL_C = Vector((60, 400, 0))      # windows face the hill, where the stretch looks from
N_BLD = [0, 0]
def building(c, yaw, w, d, h):
    ex = Vector((math.cos(yaw), math.sin(yaw), 0)); ey = Vector((-ex.y, ex.x, 0)); UP = Vector((0, 0, 1))
    k = CR.choice(['wplaster', 'wplaster', 'gplaster', 'conc', 'yplaster', 'bplaster']); col = tone()
    z0 = c.z - 0.5
    corners = [c + ex * (sx * w / 2) + ey * (sy * d / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for q in range(4):
        a, b = corners[q], corners[(q + 1) % 4]; L_ = (b - a).length; u = (b - a) / L_; n_ = Vector((u.y, -u.x, 0))      # outward
        CS.face([a + UP * (z0 - c.z), b + UP * (z0 - c.z), b + UP * (h), a + UP * (h)], k, col)
        mid = (a + b) / 2; to_hill = (HILL_C - mid).to_2d().normalized(); ni, nd = near(mid.x, mid.y)
        if n_.to_2d().dot(to_hill) < 0.25 and nd > 70: continue
        P = lambda x, y, z, a=a, u=u, n_=n_: a + u * x + n_ * (-y) + UP * z
        nx_ = int(L_ / 3.4); nf = int(h / 3.0)
        for f_ in range(1, nf):
            for xq in range(nx_):
                win_far(P, (xq + 0.5) * L_ / nx_, f_ * 3.0 + 0.9, 1.4, 1.2)
    CS.face([corners[0] + UP * h, corners[1] + UP * h, corners[2] + UP * h, corners[3] + UP * h], 'conc', tone())
    if CR.random() < 0.6:
        t_ = c + ex * CR.uniform(-w / 4, w / 4) + ey * CR.uniform(-d / 4, d / 4); blue = CR.random() < 0.5
        CS.cyl(t_, 1.2, h, h + 1.8, 'tank' if blue else 'fibre', (0.12, 0.3, 0.75) if blue else (0.7, 0.7, 0.68), n=8)
    N_BLD[0] += 1
# the flat: blocks on a 56 x 44 m grid, turned to the avenue (the start straight runs east along y = 0)
for gx in np.arange(-1500, 1800, 56.0):
    for gy in np.arange(-280, 300, 44.0):
        for q in range(CR.choice([1, 2, 2, 3])):
            w, d = CR.uniform(14, 30), CR.uniform(12, 24); c = Vector((gx + CR.uniform(-12, 12), gy + CR.uniform(-8, 8), 0))
            ni, nd = near(c.x, c.y)
            if nd < 26 + max(w, d) / 2: continue
            g = ground_at(c.x, c.y)
            if g > 7.0 or g < -0.5: continue      # the hill is the morro's, the sand the beach's
            if foot(c - Vector((0, d / 2 + 1, 0)), Vector((1, 0, 0)), w + 2, d + 2) & OCC: continue      # the street's own frontage stands there
            c.z = g; tall = 1 - ss(-240, -120, c.y)      # the beach front stands tall
            h = CR.uniform(10, 30) * (1 - tall) + CR.uniform(30, 52) * tall
            building(c, CR.uniform(-0.06, 0.06), w, d, h)
            if q == 0 and CR.random() < 0.5:
                N_BLD[1] += 1; lp = c + Vector((w / 2 + 6, 0, 8.5)); LG.face([lp + Vector((-0.4, -0.4, 0)), lp + Vector((-0.4, 0.4, 0)), lp + Vector((0.4, 0.4, 0)), lp + Vector((0.4, -0.4, 0))], 'lamp')
# the other morros: their houses' windows scattered up the slopes, turned to the lap
NHL = 0
for hx, hy, hh, hr in HILLS:
    for q in range(int(hr * 3.2)):
        a_, r_ = CR.uniform(0, 2 * math.pi), hr * math.sqrt(CR.random()) * 0.85; x, y = hx + r_ * math.cos(a_), hy + r_ * math.sin(a_)
        z = ground_at(x, y)
        if z < 6 or near(x, y)[1] < 300: continue
        p = Vector((x, y, z + CR.uniform(1.0, 9.0))); to_c = (Vector((0, 150, 0)) - p).to_2d().normalized(); u = Vector((-to_c.y, to_c.x, 0)); w, h = CR.uniform(1.4, 3.0), CR.uniform(1.0, 1.6)
        cu = CR.randrange(8); v0, v1 = (0.51, 0.99) if CR.random() < 0.6 else (0.01, 0.49)
        GW.face([p - u * w / 2, p + u * w / 2, p + u * w / 2 + Vector((0, 0, h)), p - u * w / 2 + Vector((0, 0, h))], 'wglow', uv=[((cu + 0.02) / 8, v0), ((cu + 0.98) / 8, v0), ((cu + 0.98) / 8, v1), ((cu + 0.02) / 8, v1)])
        NHL += 1
CS.done(); GW.done(); LG.done()
log('city: buildings', N_BLD[0], 'street lamp points', N_BLD[1], 'hill windows', NHL)
