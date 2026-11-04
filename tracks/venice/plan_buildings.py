"""Where the lower loop's buildings and the city district go, over the user's sketch -> out/plan/building_plan.png. Footprints in sketch pixels (1 px = 1.314 m at 6.0 km). A proposal for the user, not the build."""
from pathlib import Path
from PIL import Image
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle
H = Path(__file__).parent; INK, CITY, HERO, WATER, LAND = '#1d1d1f', '#e7c9a0', '#c2410c', '#9ec5cf', '#efeadf'
fig, ax = plt.subplots(figsize=(14, 9.2), dpi=110, facecolor='white')
ax.add_patch(Rectangle((-20, 680), 1600, 400, fc=WATER, ec='none', zorder=0))       # the lagoon, for the lower half only
ax.add_patch(Rectangle((170, 690), 1330, 345, fc=LAND, ec='none', zorder=0.5))      # the land this plan needs
ax.imshow(Image.open(H / 'source' / 'user_sketch.png').convert('RGBA'), alpha=0.55, zorder=1)
def box(x, y, w, h, c=CITY, z=3): ax.add_patch(Rectangle((x, y), w, h, fc=c, ec=INK, lw=1, zorder=z))
def label(x, y, t, c=INK, **k): ax.text(x, y, t, ha='center', va='center', fontsize=9.5, color=c, zorder=6, **k)
# the canal down the middle of the lower loop, and the city either side
ax.add_patch(Rectangle((395, 788), 715, 36, fc=WATER, ec=INK, lw=1, zorder=2)); label(960, 806, 'Canal, about 45 m wide')
for x0, x1, t in ((365, 760, 'Half-timber streets'), (790, 1125, 'Brick Gothic gables')):
    box(x0, 730, x1 - x0, 50); box(x0, 832, x1 - x0, 52); label((x0 + x1) / 2 + (70 if x0 < 500 else 0), 755, t)
# the heroes: numbered, largest first
HEROES = [(1, 1405, 885, 'Capitol-type dome hall', 60), (2, 212, 742, 'Clock-tower town hall', 42), (3, 875, 975, 'Stone colonnade block', 0), (4, 680, 858, 'Bell-dome church', 24), (5, 480, 755, 'Twin-spire cathedral', 0), (6, 1138, 806, 'Brick gate', 0)]
box(1370, 830, 70, 110, HERO, 4); ax.add_patch(Circle((1405, 885), 30, fc='#f4f1ea', ec=INK, lw=1.2, zorder=5))
box(170, 705, 84, 74, HERO, 4); box(760, 950, 230, 50, HERO, 4); ax.add_patch(Circle((680, 858), 22, fc=HERO, ec=INK, lw=1, zorder=5)); box(425, 733, 110, 44, HERO, 4); box(1125, 788, 26, 36, HERO, 4)
for n, x, y, t, r in HEROES:
    ax.text(x, y, str(n), ha='center', va='center', fontsize=9.5, color='white', fontweight='bold', bbox=dict(boxstyle='circle,pad=0.25', fc=INK, ec='none'), zorder=7)
ax.text(1000, 1058, 'Bottom straight heading east: the dome (1) stands dead ahead for 1.1 km', ha='center', fontsize=10.5, color=INK, fontweight='bold', zorder=6)
ax.text(30, 640, 'Falling straight\nheading west:\nthe clock tower (2)\nrises beyond the\ntunnel mouth', fontsize=9.5, color=INK, zorder=6, va='center')
key = '\n'.join(f'{n}  {t}' for n, _, _, t, _ in HEROES)
ax.text(1215, 620, key, fontsize=10.5, color=INK, zorder=7, va='center', bbox=dict(boxstyle='round,pad=0.5', fc='white', ec='#d4d4d8'))
ax.plot([1110, 1110 + 500 / 1.314], [1075, 1075], color=INK, lw=3, zorder=6); ax.text(1110 + 250 / 1.314, 1095, '500 m', ha='center', fontsize=10, color=INK)
ax.set_xlim(-20, 1520); ax.set_ylim(1110, 0); ax.axis('off')
ax.set_title('Venice: proposed buildings for the lower loop and the city district. The upper half stays Venetian', loc='left', fontsize=13, fontweight='bold', color=INK)
fig.savefig(H / 'out' / 'plan' / 'building_plan.png', bbox_inches='tight')
