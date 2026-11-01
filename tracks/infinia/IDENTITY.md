# Infinia: identity brief

The first pass read as a generic city: grey boxes, grass, a bay. Tokyo works because every part of its lap has things that could only be Tokyo (the temple street, the neon straight, lanterns, kanji, Fuji). Infinia has to do the same for a Mumbai-style bay city. This brief is the list of those things, section by section, and the rule: **no grey box ships.** Every building has a recognisable type, colour and detail; every stretch of road has something on it.

Our own place, not a copy: no real building, brand, logo or real landmark is reproduced. The real city is the reference for types (a sea wall, a chawl, a dargah on an islet), never for specific buildings.

## Palette and atmosphere
- Warm humid haze over the sea (fog toward a pale warm grey, never blue), a low orange sun at dusk.
- Walls in sun-faded pastels: ochre, salmon, sea-green, pale blue, cream; monsoon black streaks down every wall (vertex-colour grime, top to bottom).
- Accents: black-and-yellow taxis, marigold orange, festival red, the green of palms and peepal trees.

## The lap, section by section

**1. The start: the toll plaza and bridge approach (west shore).**
- A long toll plaza canopy across a wide apron beside the track (booths, lane lights, gantry with lane arrows). The grid starts beside it.
- A grandstand on the plaza side; sponsor boards on the walls.
- The bridge climbs from here. Lamp posts become the bridge's own slim lights.

**2. The sea link (the hero, keep it).**
- The diamond tower gets its real detail: a hollow diamond lower part, the upper legs meeting in a slender spire, a lit crown.
- The stays become a dense fan in two planes, with lights along the deck edge at night.
- Expansion joints across the deck, crash barriers with a steel rail, deck lighting columns at a steady pitch.
- Below: fishing boats crossing under the spans.

**3. The east shore: Koliwada fishing village.**
- Where the bridge lands: a cluster of small colourful fishermen's houses (2-3 storeys, painted, tin roofs).
- Koli boats pulled up on the shore with flags, nets drying on frames, a small temple shrine.

**4. The old city (east loop, the twisty part).**
- **Chawls:** long 4-storey tenements with continuous balconies and railings, laundry lines, doors in a row.
- **Shops:** a ground-floor shop row with roll-up shutters and Marathi/Hindi/English signs (our own invented shop names, Devanagari shaped properly through Windows' Nirmala UI, as India Ghat's signs are).
- **Street life:** hoardings, a tangle of overhead wires between electric poles, chai and vada-pav carts, parked auto-rickshaws and taxis.
- **Landmark:** a Hindu temple with a tall shikhara at a corner (the old city's landmark).
- **Rooftops:** plastic water tanks, dish antennas, pigeon coops.

**5. The towers district (east loop, the fast arc).**
- Varied glass and concrete towers with distinct crowns.
- One tower under construction with a tower crane and a green safety net.
- A metro viaduct on columns beside the arc.
- Palms in the medians.

**6. The tunnel.**
- Portal faces with a cut-stone facade and a name band.
- Inside: a stone dado, truck-art bands ("Horn OK Please"), mural panels in sea teal, marigold, rose and indigo, lit film posters and ads along both walls, dark concrete above, one continuous warm light line.

**7. The Necklace (the west loop's seafront arc).**
- **Sea wall:** concrete tetrapods piled along the water.
- **Promenade:** a wide promenade with a low wall, people sitting on it (cards).
- **Lamps:** the curved double-arm streetlights at a tight even pitch, the "necklace" at night.
- **Buildings:** a row of art-deco buildings facing the sea, with curved corner balconies, horizontal bands, porthole windows, cream and pastel.
- **Trees:** coconut palms along the promenade.
- **Out in the bay:** a white dargah on a small islet reached by a causeway, a respectful landmark.

**8. The bay and the horizon.**
- **Water:** the bay is Marina's sea shader.
- **Skyline:** a far skyline band of our own towers rendered in Blender, as Tokyo's skyline arc was baked: dusk and night copies with lit windows.

**9. The lanes (added at the user's request, 2026-11-01): not all skyline.**
- **Where:** the old city's second half, and the west loop just after the tunnel.
- **Homes:** Dharavi-style stacked one- to three-storey homes in plaster, brick and tin, each storey its own size and offset; tarps and tin roofs held down by tyres; ladders and washing.
- **In the lanes:** blue drums, tyre stacks, planks, runs of tin fence, wires overhead.
- **Landmarks:** the temple and the dargah; a small white mosque across the water; and on the Necklace, at the user's request, a grand seafront hotel modelled on the user's reference of the Taj Mahal Palace (grey block stone, round arches, hemispherical ribbed red domes on round corner towers, long red roofs, sand bay columns with red eaves): built here in Blender, not a measured copy.
- **The horizon:** towers cover at most 60 % of each far shore (`SKYLINE`, asserted in the build); the rest is low city and wooded hills. One hill carries a big white BOLLYWOOD sign (`tex/bollywood.png`, alpha cut, lit from evening on).

**10. The road's own furniture (researched 2026-11-01; figures from secondary sources, see the session brief).**
- **Ads:** steel unipoles beside the road at least 70 m apart, 3:1 art inside the 40 x 40 ft cap, top under 60 ft, frames overbuilt and visible behind the face. Never on a gantry.
- **Gantries:** only green direction signs, white on green with a white border, Marathi then Hindi then English.
- **Welcome boards:** at the two ways into the city. No real "Welcome to Mumbai" board was found: the wording is ours.
- **Political:** the party's boards (the India map's own) on unipoles, poles and tied railings, thickest on the sea front and through the lanes, as reported. The brief's "no political slogans" rule above was overridden by the user for this.
- **Mini hoardings:** brand boards on thin poles by the wall, about every 85 m.

## Night
- Lit windows in every district (the lit-window shell, already in place).
- The necklace of seafront lamps, the bridge's deck and cable lights, shop signs glowing.
- A few festival light strings in the old city. Steady, never blinking.

## What comes from where
- **Built here in Blender (kits, procedural, our own):** chawls, art-deco blocks, the fishing village, towers, the toll plaza, the tetrapods, overhead wires, water tanks, the temple, the dargah, the metro viaduct, the bridge details, the tunnel portals.
- **Generated here:** facade textures per building type, the Marathi/Hindi/English sign atlas, hoardings with invented brands, the crowd cards.
- **Downloaded (CC0 / CC BY, each with your OK):** palms and a broad tree, an auto-rickshaw, a taxi, a bus, a scooter, a fishing boat, where a good model exists. The asset search lists the candidates.
- **Not used (unless the user asks, as with the road's ads, the Taj and the tunnel's film posters):** real brands or logos, real buildings, political or religious slogans.

## Budget
- **Frame time:** inside India Ghat's day bench (8-9 ms at 1600x900 here).
- **Instancing:** cars, trees, boats, tanks and props are repeated pieces merged per material.
- **Facades:** windows are textures, not geometry.
