#!/bin/sh
# one browser lock hold: the before/after shots + frame-time A/B in one session, then the standard qa-tokyo-views run with the part
# (after) and without it (?tmat=0, before)
cd "$(dirname "$0")/../../.."
echo "== A/B shots and bench"; BENCH=1 BENCH_LOOKS=night,day OUT=qa/tokyo-refactor/materials node scripts/qa-tokyo-materials.mjs
echo "== official after"; OUT=qa/tokyo-refactor/materials/official-after node scripts/qa-tokyo-views.mjs http://127.0.0.1:5180 day,dusk,bluehour,night
echo "== official before"; OUT=qa/tokyo-refactor/materials/official-before node scripts/qa-tokyo-views.mjs "http://127.0.0.1:5180/?tmat=0" day,dusk,bluehour,night
echo "== done"
