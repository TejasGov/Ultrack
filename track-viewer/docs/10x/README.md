# docs/10x

- `perf-spec.md`: the build spec for part 1 (web performance), work packages WP0 to WP10.
- `perf-results.md`: every work package, kept or dropped, with its measured numbers and how to re-run each measurement.
- `wp2-merge-wheels.patch`: WP2, not on the branch. It merges each car's stand-in wheels (5 meshes a wheel) and the far wheel proxy (20 meshes) by material, 2 meshes each, behind `?perf=mergeWheels`, and adds a mesh-count assert to perf-frame. Measured: main-pass draws 416 -> 346 on qingshan and 332 -> 263 on llano, pixels identical (MAD 0.000) and triangles matched, but the race tick moved by less than its spread (qingshan 6.75 -> 6.50 ms against a 1.35 ms spread), so it failed its gate. To try it: `git apply track-viewer/docs/10x/wp2-merge-wheels.patch` from the repo root; `git apply -R` takes it out.
