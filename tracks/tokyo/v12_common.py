"""Shared helpers for the Tokyo v12 art pass: the resampled centerline (out/centerline-v10.json) and the review cameras.

Used by art_v12.py (builds out/tokyo_v12.blend), render_v12.py (EEVEE review renders) and clearance_v12.py.
Coordinates are v10's Blender world (the same as centerline-v10.json). Side +1 is the left of the direction of travel.
"""
import json
import math
from pathlib import Path

import numpy as np

T = Path(__file__).resolve().parent
O = T / 'out'
STEP = 2.0                    # resample spacing, metres of arc length
START_XY = (-188.67, -513.70)   # start gantry of v10


class CL:
    def __init__(self):
        raw = np.array(json.load(open(O / 'centerline-v10.json'))['points'], dtype=float)
        self.raw = raw
        closed = np.vstack([raw, raw[:1]])
        seg = np.linalg.norm(np.diff(closed[:, :2], axis=0), axis=1)
        cum = np.concatenate([[0], np.cumsum(seg)])
        self.length = cum[-1]
        self.M = int(self.length / STEP)
        ss = np.linspace(0, self.length, self.M, endpoint=False)
        self.P = np.stack([np.interp(ss, cum, closed[:, k]) for k in range(3)], axis=1)
        t = np.roll(self.P, -2, 0) - np.roll(self.P, 2, 0)
        t[:, 2] = 0
        self.T = t / np.linalg.norm(t, axis=1)[:, None]
        self.N = np.stack([-self.T[:, 1], self.T[:, 0], np.zeros(self.M)], axis=1)     # left normal
        self.s0 = int(np.argmin((self.P[:, 0] - START_XY[0]) ** 2 + (self.P[:, 1] - START_XY[1]) ** 2))

    def at(self, i, lat=0.0, dz=0.0):
        i %= self.M
        return self.P[i] + self.N[i] * lat + np.array([0, 0, dz])

    def nearest(self, x, y):
        d = (self.P[:, 0] - x) ** 2 + (self.P[:, 1] - y) ** 2
        i = int(np.argmin(d))
        rel = np.array([x, y]) - self.P[i, :2]
        return i, math.sqrt(float(d[i])), float(rel @ self.N[i, :2])     # index, distance, signed lateral


def cameras(cl):
    """name -> (location, target, lens mm). Both the v10 'before' renders and the v12 renders use the same a/f cameras."""
    s0 = cl.s0
    c = {}
    c['a_start_straight'] = (cl.at(s0 - 16, 0.5, 1.7), cl.at(s0 + 70, 0, 4.5), 22)
    c['f_stand_clearance'] = (cl.at(s0 - 52, 3.0, 2.4), cl.at(s0 - 6, -27, 7.5), 17)
    return c


def night_world(sc):
    """dark navy night world (used by the v12 scene and by the v10 'before' renders)"""
    import bpy
    w = bpy.data.worlds.new('V12 night')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sp = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.5, (0.035, 0.024, 0.07, 1)       # horizon glow, dusky purple
    el[1].position, el[1].color = 0.64, (0.002, 0.004, 0.016, 1)       # zenith, near black navy
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.5
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(tc.outputs['Generated'], sp.inputs[0])
    nt.links.new(sp.outputs['Z'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs[0], bg.inputs['Color'])
    nt.links.new(bg.outputs[0], out.inputs[0])
    sc.world = w


def setup_eevee(sc, w=1600, h=900, samples=16):
    import bpy
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = samples
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = -0.2
    try:
        sc.eevee.use_raytracing = True
        sc.eevee.ray_tracing_options.resolution_scale = '2'
    except Exception as e:  # noqa
        print('raytracing not set', e)
    for o in sc.objects:
        if o.type == 'LIGHT':
            o.data.use_shadow = False if o.data.type != 'SUN' else True
            if o.data.type != 'SUN' and not o.name.startswith(('V12', 'gantry')) and not o.data.get('v12_scaled') and not any(c.name.startswith(('Bridge', 'V6')) for c in o.users_collection):
                o.data.energy *= 0.45          # v10's lights were set for Cycles at night; EEVEE with raytracing reads hotter
                o.data['v12_scaled'] = 1
        if o.type == 'LIGHT' and o.data.type == 'SUN':
            o.data.energy = 0.25 if o.data.energy > 0.3 else o.data.energy
            o.data.color = (0.55, 0.65, 1.0)
