"""Corniche Marina Circuit: the layout as straights and constant-radius arcs, closed exactly, sampled every SPACING m.

Pure Python (no bpy): the Blender build and the plot preview both import it.
Plan coordinates: x east, y north, metres (Blender's ground plane; glTF export turns Z-up into Y-up).
Anti-clockwise, so the infield is on the LEFT of travel and positive arc angles turn left.
"""
import math

SPACING = 4.5   # same as the reference game's centerline spacing

# (kind, ...): ("S", name, length) or ("A", name, radius, degrees, +left/-right).
# Half-widths in metres per segment (track widths: main straight 15, regular 12-14, hairpins 11).
SEGMENTS = [
    # bottom: east
    ("S", "Main Straight", 800, 7.5),
    ("A", "T1 Gate", 45, 90, 7.0),                 # -> north
    ("S", "T1-T2", 200, 7.0),
    ("A", "T2 Dune Esses", 200, 30, 6.5),
    ("A", "T3 Dune Esses", 150, -60, 6.5),
    ("A", "T4 Dune Esses", 200, 30, 6.5),
    ("S", "Dune Link", 120, 6.5),
    ("A", "T5 Dune Exit", 60, -90, 6.5),           # -> east
    ("S", "Hairpin Approach", 380, 7.0),
    ("A", "T6 Hairpin", 20, 180, 5.5),             # -> west
    # top: west
    ("S", "Back Straight A", 600, 7.0),
    ("A", "Back Straight Kink", 700, -8, 7.0),
    ("S", "Back Straight B", 600, 7.0),
    ("A", "T7 Chicane", 24, -55, 6.0),
    ("A", "T8 Chicane", 24, 55, 6.0),
    ("S", "Second Straight", 300, 7.0),
    ("A", "T9 Harbour", 30, 90, 6.0),              # -> south
    # west side: the marina jog out toward the water and back
    ("S", "Harbour Straight", 250, 6.5),
    ("A", "T10 Marina", 30, -90, 6.0),             # -> west
    ("S", "Marina Run A", 110, 6.0),
    ("A", "T11 Marina", 30, 90, 6.0),              # -> south
    ("S", "Marina Run B", 160, 6.0),
    ("A", "T12 Marina", 32, 90, 6.0),              # -> east
    ("S", "Marina Run C", 110, 6.0),
    ("A", "T13 Marina", 32, -90, 6.0),             # -> south
    ("S", "Boardwalk Link", 100, 6.0),
    ("A", "T14 Boardwalk", 22, 50, 5.75),
    ("A", "T15 Boardwalk", 22, -50, 5.75),
    ("S", "Final Link", 120, 6.5),
    ("A", "T16 Final Turn", 90, 0, 7.0),           # angle solved so the loop turns exactly +360 -> east
]
CLOSE_STRAIGHTS = ("Main Straight", "Harbour Straight")   # perpendicular, so the closing solve is well conditioned
SF_FROM_MAIN_START = 0.55   # start/finish line sits this fraction along the main straight


def _heading_close(segs):
    turned = sum(s[3] for s in segs if s[0] == "A" and s[1] != "T16 Final Turn")
    return [s if s[1] != "T16 Final Turn" else (s[0], s[1], s[2], 360 - turned, s[4]) for s in segs]


def _walk(segs):
    """End position and heading of the turtle path; also the per-segment start states."""
    x = y = h = 0.0
    states = []
    for s in segs:
        states.append((x, y, h))
        if s[0] == "S":
            x += s[2] * math.cos(h); y += s[2] * math.sin(h)
        else:
            r, a = s[2], math.radians(s[3])
            cx, cy = x - r * math.sin(h) * math.copysign(1, a), y + r * math.cos(h) * math.copysign(1, a)
            h2 = h + a
            x, y = cx + r * math.sin(h2) * math.copysign(1, a), cy - r * math.cos(h2) * math.copysign(1, a)
            h = h2
    return x, y, h, states


def closed_segments():
    """Segments with T16's angle and the two closing straights solved so the path ends where it starts."""
    segs = _heading_close(SEGMENTS)
    ex, ey, _, states = _walk(segs)
    idx = [i for i, s in enumerate(segs) if s[1] in CLOSE_STRAIGHTS]
    d = [(math.cos(states[i][2]), math.sin(states[i][2])) for i in idx]
    det = d[0][0] * d[1][1] - d[0][1] * d[1][0]
    assert abs(det) > 0.2, "closing straights are nearly parallel; pick two that cross"
    # solve a*d0 + b*d1 = -(ex, ey)
    a = (-ex * d[1][1] + ey * d[1][0]) / det
    b = (-ey * d[0][0] + ex * d[0][1]) / det
    out = list(segs)
    for i, delta in zip(idx, (a, b)):
        s = out[i]
        out[i] = (s[0], s[1], s[2] + delta, s[3])
        assert out[i][2] > 50, f"{s[1]} would be {out[i][2]:.0f} m long; rebalance SEGMENTS"
    return out


def sample():
    """Centerline every ~SPACING m, starting at the start/finish line.

    Returns dict(points=[(x,y)], heading=[rad], curvature=[1/m, +left], halfWidth=[m], seg=[segment index],
    segments=[...], length=m, sfIndex=0).
    """
    segs = closed_segments()
    pts, hd, kap, hw, sid = [], [], [], [], []
    x = y = h = 0.0
    for si, s in enumerate(segs):
        L = s[2] if s[0] == "S" else abs(math.radians(s[3])) * s[2]
        n = max(1, round(L / SPACING))
        k = 0.0 if s[0] == "S" else math.radians(s[3]) / L
        for j in range(n):
            t = j * L / n
            if s[0] == "S":
                px, py, ph = x + t * math.cos(h), y + t * math.sin(h), h
            else:
                r, sg = s[2], math.copysign(1, s[3])
                cx, cy = x - r * math.sin(h) * sg, y + r * math.cos(h) * sg
                ph = h + k * t
                px, py = cx + r * math.sin(ph) * sg, cy - r * math.cos(ph) * sg
            pts.append((px, py)); hd.append(ph); kap.append(k); hw.append(s[-1]); sid.append(si)
        if s[0] == "S":
            x += L * math.cos(h); y += L * math.sin(h)
        else:
            r, sg = s[2], math.copysign(1, s[3])
            cx, cy = x - r * math.sin(h) * sg, y + r * math.cos(h) * sg
            h += math.radians(s[3])
            x, y = cx + r * math.sin(h) * sg, cy - r * math.cos(h) * sg
    assert math.hypot(x, y) < 1e-6 and abs(h - 2 * math.pi) < 1e-9, "loop does not close"

    # smooth half-width changes over ~40 m so the edges never step
    n = len(pts); w = 9
    hw = [sum(hw[(i + j) % n] for j in range(-w, w + 1)) / (2 * w + 1) for i in range(n)]

    # rotate so index 0 is the start/finish line, and translate it to the origin
    main_n = sum(1 for v in sid if v == 0)
    sf = int(main_n * SF_FROM_MAIN_START)
    rot = lambda a: a[sf:] + a[:sf]
    pts, hd, kap, hw, sid = map(rot, (pts, hd, kap, hw, sid))
    ox, oy = pts[0]
    pts = [(px - ox, py - oy) for px, py in pts]
    length = sum(math.dist(pts[i], pts[(i + 1) % n]) for i in range(n))
    return dict(points=pts, heading=hd, curvature=kap, halfWidth=hw, seg=sid, segments=segs, length=length, sfIndex=0)


def offset(c, i, d):
    """Point d metres to the LEFT of centerline sample i (negative = right)."""
    (x, y), h = c["points"][i], c["heading"][i]
    return (x - d * math.sin(h), y + d * math.cos(h))


# ---------------------------------------------------------------- design data (everything the build and the game read)

KERB_W = 1.2            # kerb / verge strip outside each track edge
LINE_W = 0.3            # painted white edge line, inside the edge
PIT_OFFSET = 18.0       # pit lane centre, left of the track centre (infield side)
PIT_HALF = 6.0          # 12 m pit lane: 6 m fast lane + 6 m working lane
PIT_LIMIT_KMH = 60
QUAY = 18.0             # water's edge, right of the track centre, along the marina
RUNOFF = 20.0           # grass run-off beyond the kerb (wide enough to drive onto and rejoin); walls stand behind it
HEAVY_BRAKING = ("T1 ", "T6 ", "T7 ", "T9 ")       # tarmac run-off on the outside
STREET = ("Harbour Straight", "T10", "Marina Run", "T11", "T12", "T13", "Boardwalk", "T14", "T15")   # walls close, no run-off


def _seg_range(c, prefix):
    idx = [i for i, s in enumerate(c["seg"]) if c["segments"][s][1].startswith(prefix)]
    # indices of one segment are consecutive, but may wrap around index 0
    n = len(c["points"])
    start = next(i for i in idx if (i - 1) % n not in idx)
    return start, len(idx)


def _smooth(vals, w):
    n = len(vals)
    return [sum(vals[(i + j) % n] for j in range(-w, w + 1)) / (2 * w + 1) for i in range(n)]


def _smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def corners(c):
    out = []
    for s in c["segments"]:
        if s[0] == "A" and abs(s[3]) >= 20:
            a, m = _seg_range(c, s[1])
            out.append(dict(id=s[1].split(" ")[0], name=" ".join(s[1].split(" ")[1:]), radius=s[2], angle=round(s[3], 1),
                            start=a, count=m, apexIdx=(a + m // 2) % len(c["points"])))
    return out


def pit(c):
    """Pit offset per sample (0 = on track) and the pit lane's index span, entry on the inside of T16, exit after T1."""
    n = len(c["points"])
    t16, n16 = _seg_range(c, "T16")
    t1, n1 = _seg_range(c, "T1 ")
    entry = (t16 + int(n16 * 0.35)) % n          # ramp starts here
    exit_ = (t1 + n1 + 34) % n                    # back on track here (34 samples ~ 150 m into the T1-T2 straight)
    span = (exit_ - entry) % n
    d = [0.0] * n
    for k in range(span + 1):
        i = (entry + k) % n
        d[i] = PIT_OFFSET * _smoothstep(0, 34, k) * (1 - _smoothstep(span - 34, span, k))
    return dict(offset=d, entry=entry, exit=exit_, span=span)


def _wall_caps(c, reach=80.0):
    """Max wall distance per sample and side: the midline between this edge and any other part of the track within reach."""
    pts, hd, hw, n = c["points"], c["heading"], c["halfWidth"], len(c["points"])
    cap = {"L": [1e9] * n, "R": [1e9] * n}
    for i in range(n):
        (x, y), h = pts[i], hd[i]
        nx, ny = -math.sin(h), math.cos(h)
        for j in range(n):
            if min((i - j) % n, (j - i) % n) < 40:
                continue
            dx, dy = pts[j][0] - x, pts[j][1] - y
            d = math.hypot(dx, dy)
            if d > reach + hw[i] + hw[j]:
                continue
            lat = dx * nx + dy * ny            # + = that part of the track is on our left
            if abs(lat) < 0.7 * d:             # only parts facing us across the run-off, not ahead/behind
                continue
            mid = (abs(lat) + hw[i] - hw[j]) / 2 - 0.4
            side = "L" if lat > 0 else "R"
            cap[side][i] = min(cap[side][i], mid)
    return {s: _smooth(v, 3) if min(v) < 1e8 else v for s, v in cap.items()}


def sides(c):
    """Per sample and side ('L', 'R'): kerb flag, run-off kind and wall distance from the centre line (None = no wall)."""
    n = len(c["points"])
    kerb = {"L": [False] * n, "R": [False] * n}
    for k in corners(c):
        if k["radius"] <= 250:
            for j in range(-6, k["count"] + 6):
                i = (k["start"] + j) % n
                kerb["L"][i] = kerb["R"][i] = True
    street = [any(c["segments"][s][1].startswith(p) for p in STREET) for s in c["seg"]]
    gap = {"L": [RUNOFF] * n, "R": [RUNOFF] * n}      # run-off depth beyond the shoulder
    kind = {"L": ["grass"] * n, "R": ["grass"] * n}
    for k in corners(c):                              # gravel traps on the outside of the slower corners
        if k["radius"] <= 250:
            out = "R" if k["angle"] > 0 else "L"
            for j in range(-4, k["count"] + 10):
                kind[out][(k["start"] + j) % n] = "sand"
    for k in corners(c):
        if any((k["id"] + " ").startswith(p) for p in HEAVY_BRAKING):
            out = "R" if k["angle"] > 0 else "L"
            for j in range(-12, k["count"] + 6):     # covers the braking zone too
                i = (k["start"] + j) % n
                gap[out][i], kind[out][i] = 30.0, "tarmac"
    for i in range(n):
        if street[i]:
            for sd in "LR":
                gap[sd][i], kind[sd][i] = 1.5, "paved"
    p = pit(c)
    for i in range(n):          # main straight: grandstand side keeps 10 m, the pit side is the pit wall
        if c["seg"][i] == 0:
            gap["R"][i] = 8.0
    gl, gr = _smooth(gap["L"], 8), _smooth(gap["R"], 8)
    hw = c["halfWidth"]
    # where two parts of the circuit run close (the hairpin's straights), both walls stop at the midline: one shared wall
    cap = _wall_caps(c)
    for i in range(n):
        gl[i] = min(gl[i], cap["L"][i] - hw[i] - KERB_W)
        gr[i] = min(gr[i], cap["R"][i] - hw[i] - KERB_W)
    wall = {"L": [], "R": []}
    for i in range(n):
        d = p["offset"][i]
        if d > 0.5:   # over the pit lane's span the infield side is open tarmac out to the pit lane's edge
            kind["L"][i] = "tarmac"
            gl[i] = max(gl[i], d + PIT_HALF - hw[i] - KERB_W) if d < hw[i] + KERB_W + PIT_HALF + 0.5 else d - PIT_HALF - hw[i] - KERB_W
            wall["L"].append(None)
        else:
            wall["L"].append(hw[i] + KERB_W + gl[i])
        wall["R"].append(hw[i] + KERB_W + gr[i])
    return dict(kerb=kerb, kind=kind, runoffL=[hw[i] + KERB_W + gl[i] for i in range(n)],
                runoffR=[hw[i] + KERB_W + gr[i] for i in range(n)], wall=wall, street=street)


def pit_lane(c):
    """Pit lane centre polyline (only where it has left the track), limiter lines and boxes."""
    p = pit(c)
    n = len(c["points"])
    idx = [(p["entry"] + k) % n for k in range(p["span"] + 1)]
    lane = [i for i in idx if p["offset"][i] >= c["halfWidth"][i] + KERB_W + PIT_HALF]
    full = [i for i in lane if p["offset"][i] >= PIT_OFFSET - 0.05]
    # 12 boxes (six teams, two cars each), 14 m apart, centred on the start/finish line, on the garage side of the
    # working lane; assets/teams/teams.json gives each team its pair
    centre = min(full, key=lambda i: min(i, n - i))
    k0 = full.index(centre) - round(5.5 * 14 / SPACING)
    boxes = []
    for b in range(12):
        i = full[k0 + round(b * 14 / SPACING)]
        x, y = offset(c, i, PIT_OFFSET + 3.0)
        boxes.append(dict(id=b + 1, idx=i, pos=(x, y), heading=c["heading"][i]))
    return dict(indices=lane, full=full, points=[offset(c, i, p["offset"][i]) for i in lane],
                limiterIn=lane[0], limiterOut=lane[-1], boxes=boxes, **p)


def water_polygon(c):
    """The marina basin: the water's edge QUAY m right of the track from the harbour straight to T13, closed out west."""
    n = len(c["points"])
    a, _ = _seg_range(c, "Harbour Straight")
    a += 10                       # clear of T9's run-off, whose wall sits further out than the quay
    b, m = _seg_range(c, "T13")
    edge = [offset(c, (a + k) % n, -QUAY) for k in range((b + m - a) % n + 1)]
    far = min(x for x, _ in c["points"]) - 900
    return edge + [(far, edge[-1][1] - 150), (far, edge[0][1] + 60), (edge[0][0] - 40, edge[0][1] + 60)]


def point_in_poly(p, poly):
    x, y = p
    inside = False
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            inside = not inside
    return inside


def racing_line(c, margin=1.3, iters=3000):
    """Lateral offset (+left) of an approximate minimum-curvature line, kept margin m inside each edge.

    Gauss-Seidel relaxation: each point moves along its normal toward the midpoint of neighbours `span` samples
    away, with the span shrinking coarse-to-fine so long sweeps settle before local detail. Good enough for the
    rubbered line, wet-line drying and AI/ghost targets; not a lap-time optimiser.
    """
    pts, hd, hw, n = c["points"], c["heading"], c["halfWidth"], len(c["points"])
    nx = [-math.sin(h) for h in hd]
    ny = [math.cos(h) for h in hd]
    e = [0.0] * n
    for it in range(iters):
        span = 12 if it < iters // 3 else 6 if it < 2 * iters // 3 else 2
        for i in range(n):
            a, b = (i - span) % n, (i + span) % n
            mx = (pts[a][0] + e[a] * nx[a] + pts[b][0] + e[b] * nx[b]) / 2
            my = (pts[a][1] + e[a] * ny[a] + pts[b][1] + e[b] * ny[b]) / 2
            t = (mx - pts[i][0]) * nx[i] + (my - pts[i][1]) * ny[i]
            lim = hw[i] - margin
            e[i] = max(-lim, min(lim, t))
    return e


def braking_zones(c, length=140.0):
    """Per sample 0..1: how hard cars brake here (ramps up over `length` m before every corner of radius < 100 m)."""
    n = len(c["points"])
    out = [0.0] * n
    for k in corners(c):
        if k["radius"] >= 100:
            continue
        m = int(length / SPACING)
        for j in range(m):
            i = (k["start"] - m + j) % n
            out[i] = max(out[i], (j / m) ** 0.7)
    return out


def grid_slots(c):
    """8 staggered grid slots behind the line: 8 m apart, alternating 3 m left/right."""
    n = len(c["points"])
    out = []
    for k in range(8):
        i = (-round((8 + 8 * k) / SPACING)) % n
        out.append(dict(slot=k + 1, idx=i, pos=offset(c, i, 3.0 if k % 2 == 0 else -3.0), heading=c["heading"][i]))
    return out


def check_clearance(c, margin=8.0):
    """No two parts of the circuit closer than their half-widths + margin (walls and run-off need the room)."""
    pts, hw, n = c["points"], c["halfWidth"], len(c["points"])
    worst = None
    for i in range(0, n, 2):
        for j in range(i + 40, n, 2):
            if (i - j) % n < 40:
                continue
            gapm = math.dist(pts[i], pts[j]) - hw[i] - hw[j]
            if worst is None or gapm < worst[0]:
                worst = (gapm, i, j)
    assert worst[0] >= margin, f"track too close to itself: {worst[0]:.1f} m between samples {worst[1]} and {worst[2]}"
    return worst


def to_game(x, y, z=0.0):
    """Blender plan (x east, y north, z up) -> game / glTF (x, y up, z = -north)."""
    return [round(x, 3), round(z, 3), round(-y, 3)]


def export_json(c, path, name="Corniche Marina Circuit", sd=None, landmarks=None):
    import json
    n = len(c["points"])
    sd, pl = sd or sides(c), pit_lane(c)
    cs = corners(c)
    t6 = next(k for k in cs if k["id"] == "T6")["apexIdx"]
    t9 = next(k for k in cs if k["id"] == "T9")["apexIdx"]
    data = {
        "name": name,
        "units": "metres; game coords: Y up, x east, -z north; origin = start/finish line centre",
        "direction": "anticlockwise (seen from above)",
        "lapLength": round(c["length"], 1),
        "credits": ["Textures/models: Poly Haven (CC0), see assets/polyhaven/CREDITS.md"],
        "spacing": SPACING,
        "centerline": [to_game(*p) for p in c["points"]],
        "halfWidth": [round(v, 2) for v in c["halfWidth"]],
        "racingLine": [round(v, 2) for v in racing_line(c)],   # lateral offset from the centre line, + = left
        "slope": [0.0] * n,
        "banking": [0.0] * n,
        "headingYawRad": [round(math.pi / 2 - h, 4) for h in c["heading"]],   # rotation.y turning local +Z onto travel
        "sectors": [0, t6, t9],
        "checkpoints": list(range(0, n, 25)),
        "corners": [dict(id=k["id"], name=k["name"], radius=k["radius"], angle=k["angle"], apexIdx=k["apexIdx"],
                         boards=[150, 100, 50] if any((k["id"] + " ").startswith(p) for p in HEAVY_BRAKING) else []) for k in cs],
        "start": {"pos": [0, 0, 0], "headingYawRad": round(math.pi / 2 - c["heading"][0], 4),
                  "gridSlots": [dict(slot=g["slot"], centerlineIdx=g["idx"], pos=to_game(*g["pos"]),
                                     headingYawRad=round(math.pi / 2 - g["heading"], 4)) for g in grid_slots(c)]},
        "pitLane": {
            "polyline": [to_game(*p) for p in pl["points"]],
            "entryIdx": pl["entry"], "exitIdx": pl["exit"],
            "limiterInIdx": pl["limiterIn"], "limiterOutIdx": pl["limiterOut"],
            "speedLimitKmh": PIT_LIMIT_KMH, "halfWidth": PIT_HALF,
            "boxes": [dict(id=b["id"], centerlineIdx=b["idx"], pos=to_game(*b["pos"]),
                           headingYawRad=round(math.pi / 2 - b["heading"], 4)) for b in pl["boxes"]],
            "gate": {"centerlineIdx": pl["limiterIn"], "pos": to_game(*pl["points"][0])},
            "enabledIn": ["endurance", "mp-endurance"],
        },
        "zones": [{"kind": "street", "from": i, "to": i} for i in range(n) if sd["street"][i] and not sd["street"][i - 1]],
        "weather": {"default": "dryDusk", "looks": ["goldenHour", "dusk", "night", "desertStorm"]},
        "landmarks": [{"name": "Marina", "pos": to_game(*offset(c, next(k for k in cs if k["id"] == "T11")["apexIdx"], -60))}]
                     + (landmarks or []),
        "surfaces": {"asphalt": ["col_asphalt"], "curb": ["col_curb"], "sausage": ["col_sausage"], "grass": ["col_grass"],
                     "tarmacRunoff": ["col_runoff_tarmac"],
                     "sand": ["col_sand"], "paved": ["col_paved"], "pit": ["col_pit"], "wall": ["col_wall"]},
        "collision": "marina_collision.glb", "visual": ["marina_visual.glb"],
    }
    # street zones as from/to ranges
    zs, run = [], None
    for i in range(n + 1):
        on = sd["street"][i % n]
        if on and run is None:
            run = i
        if not on and run is not None:
            zs.append({"kind": "street", "from": run % n, "to": (i - 1) % n}); run = None
    data["zones"] = zs
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, separators=(",", ":"))
    return data


def plot_extras(ax, c):
    """Called by tools/plot_layout.py: water, walls, pit lane, boxes, grid."""
    w = water_polygon(c)
    ax.fill([p[0] for p in w], [p[1] for p in w], color="#9cd", lw=0, zorder=0)
    sd = sides(c)
    n = len(c["points"])
    for side, sg in (("L", 1), ("R", -1)):
        pts = [offset(c, i, sg * sd["wall"][side][i]) if sd["wall"][side][i] is not None else (math.nan, math.nan) for i in range(n)]
        ax.plot([p[0] for p in pts], [p[1] for p in pts], color="#888", lw=0.8)
    pl = pit_lane(c)
    ax.plot([p[0] for p in pl["points"]], [p[1] for p in pl["points"]], color="#36f", lw=3)
    ax.plot([b["pos"][0] for b in pl["boxes"]], [b["pos"][1] for b in pl["boxes"]], "s", color="#fc0", ms=3)
    ax.plot([g["pos"][0] for g in grid_slots(c)], [g["pos"][1] for g in grid_slots(c)], ".", color="w", ms=3)
    rl = racing_line(c)
    p = [offset(c, i, rl[i]) for i in range(n)] + [offset(c, 0, rl[0])]
    ax.plot([q[0] for q in p], [q[1] for q in p], color="#f44", lw=0.7)


if __name__ == "__main__":
    c = sample()
    print(f"{len(c['points'])} samples, lap {c['length']:.0f} m")
    for s in c["segments"]:
        print(f"  {s[1]:20s} {'L=%.0f' % s[2] if s[0] == 'S' else 'r=%d %+.1f deg' % (s[2], s[3])}")
    gapm, i, j = check_clearance(c)
    print(f"closest approach: {gapm:.1f} m between edges (samples {i}, {j})")
    pl = pit_lane(c)
    print(f"pit lane: {len(pl['points'])} pts, entry {pl['entry']} exit {pl['exit']}, {len(pl['boxes'])} boxes")
    print(f"grid: {[g['idx'] for g in grid_slots(c)]}")
    print(f"water polygon: {len(water_polygon(c))} pts")
