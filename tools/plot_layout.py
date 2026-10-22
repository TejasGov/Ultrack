"""Top-down plot of a track layout: python tools/plot_layout.py marina -> tracks/marina/out/layout.png"""
import importlib.util, os, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

name = sys.argv[1] if len(sys.argv) > 1 else "marina"
base = os.path.join(os.path.dirname(__file__), "..", "tracks", name)
spec = importlib.util.spec_from_file_location("layout", os.path.join(base, "layout.py"))
L = importlib.util.module_from_spec(spec); spec.loader.exec_module(L)

c = L.sample()
n = len(c["points"])
left = [L.offset(c, i, c["halfWidth"][i]) for i in range(n)]
right = [L.offset(c, i, -c["halfWidth"][i]) for i in range(n)]

fig, ax = plt.subplots(figsize=(14, 11), dpi=110)
ax.fill([p[0] for p in left] + [p[0] for p in right[::-1]], [p[1] for p in left] + [p[1] for p in right[::-1]], color="#333", lw=0)
for edge in (left, right):
    ax.plot([p[0] for p in edge] + [edge[0][0]], [p[1] for p in edge] + [edge[0][1]], color="#111", lw=0.6)
extra = getattr(L, "plot_extras", None)
if extra:
    extra(ax, c)
seen = set()
for i, s in enumerate(c["seg"]):
    seg = c["segments"][s]
    if seg[0] == "A" and s not in seen and abs(seg[3]) > 15:
        idx = [j for j in range(n) if c["seg"][j] == s]
        x, y = L.offset(c, idx[len(idx) // 2], 40 if seg[3] < 0 else -40)
        ax.annotate(seg[1].split(" ")[0], (x, y), ha="center", va="center", fontsize=9, color="#c00", weight="bold")
        seen.add(s)
ax.plot(*c["points"][0], "o", color="lime", ms=8)
ax.annotate("S/F", c["points"][0], xytext=(8, -14), textcoords="offset points", color="green", weight="bold")
for k in range(0, n, 60):   # direction arrows
    (x, y), (x2, y2) = c["points"][k], c["points"][(k + 3) % n]
    ax.annotate("", (x2, y2), (x, y), arrowprops=dict(arrowstyle="->", color="#fa0"))
ax.set_aspect("equal"); ax.grid(alpha=0.2)
ax.set_title(f"{name}: lap {c['length']:.0f} m, {n} samples (grid = metres)")
os.makedirs(os.path.join(base, "out"), exist_ok=True)
out = os.path.join(base, "out", "layout.png")
fig.savefig(out, bbox_inches="tight")
print(out)
