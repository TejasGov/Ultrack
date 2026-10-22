import bpy

# Open the file
blend_path = r"D:\RaceUltimate\tracks\tokyo\out\tokyo_realism_v9.blend"
bpy.ops.wm.open_mainfile(filepath=blend_path)
s = bpy.context.scene
c = s.cycles

# 1. Enable GPU compute for Cycles
c.device = 'GPU'

# 2. Fix viewport powdery jitter: Enable Viewport Denoising!
c.use_preview_denoising = True
c.preview_denoiser = 'OPENIMAGEDENOISE'

# 3. Fix viewport lag: Cap viewport samples and set adaptive threshold
# Instead of rendering up to 1024 noisy samples, stop at 32-48 samples with denoiser
c.preview_samples = 32
c.preview_adaptive_threshold = 0.05

# 4. Final render settings
c.use_denoising = True
c.denoiser = 'OPENIMAGEDENOISE'
c.samples = 48
c.adaptive_threshold = 0.02

# 5. Optimize light bounces for real-time responsiveness
c.max_bounces = 8
c.diffuse_bounces = 3
c.glossy_bounces = 3
c.transparent_max_bounces = 6
c.volume_bounces = 0

# 6. Set viewport shading in all 3D viewports to enable smooth display
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.use_scene_lights = True
                    space.shading.use_scene_world = True

# Save the updated blend file
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("SUCCESS: Updated tokyo_realism_v9.blend with optimized viewport and GPU settings!")
