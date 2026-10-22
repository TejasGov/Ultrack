import bpy, time

prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'HIP'
for d in prefs.devices:
    if d.type == 'HIP':
        d.use = ('Radeon' in d.name)
        print(f"Device {d.name}: use={d.use}")

bpy.ops.wm.open_mainfile(filepath=r"D:\RaceUltimate\tracks\tokyo\out\tokyo_realism_v9.blend")
s = bpy.context.scene
c = s.cycles

c.device = 'GPU'
c.use_preview_denoising = True
c.preview_denoiser = 'OPENIMAGEDENOISE'
c.preview_samples = 32
c.preview_adaptive_threshold = 0.05
c.use_denoising = True
c.denoiser = 'OPENIMAGEDENOISE'
c.samples = 48
c.adaptive_threshold = 0.02

# Test render a single frame with GPU
s.render.resolution_x = 640
s.render.resolution_y = 360
s.render.resolution_percentage = 100
t0 = time.time()
bpy.ops.render.render()
print(f"GPU Render took: {time.time() - t0:.2f}s")
