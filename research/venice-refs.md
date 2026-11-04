# Venice circuit: research refs

Research date 2026-11-02. Read-only: web pages read or searched, nothing downloaded, no credits spent, no other files changed.

Tags: **[F]** = page opened and read. **[S]** = search summary only, page not opened. **(est.)** = my judgement, not sourced. Hex values are art-direction targets chosen for sRGB, not measured from anything.

---

## 0. Your draft, checked against Venice

- **Venice has no cars in its historic centre.** Its only road link is the Ponte della Libertà, which ends at Piazzale Roma [S7]. The road lap is fiction. Keep the layout, and treat it as a stylised Venice rather than a map.
- **Venice has no inland lake.** Its water is the lagoon and its canals [S15]. Use a lagoon-shaped basin tinted blue, or a fictional lake.
- **No road tunnel turned up in any source.** The closest real forms are an enclosed bridge (the Bridge of Sighs, [S6]) and covered passages under buildings, called sottoportego (my knowledge, not checked here).

---

## 1. Architecture

### 1.1 "Victorian" versus Venetian

Venice's own styles run from Byzantine (St Mark's), through Venetian Gothic (Doge's Palace and the palazzi), Renaissance (Bovolo stair, Arsenale gate), Baroque (Bridge of Sighs), to Liberty / Art Nouveau on the Lido [S1, S8, S9, S10, S6, S11].

The Victorian link is John Ruskin. *The Stones of Venice* (1851–53) made Venetian Gothic the model for the 19th-century revival [S1, S3]. Victorian-era Gothic Revival buildings are therefore Ruskin's Venice seen through British eyes. Examples on the same [F] page: Memorial Hall, Manchester (1866); Elephant Tea Rooms, Sunderland (1872–77); the old stock exchange, Melbourne (1888); a carpet factory, Glasgow (1892) [S1].

**Recommendation:** base the track on real Venetian Gothic, which is what Victorians admired. Add Lido Liberty for the garden side. Use British Victorian revival only if the user wants that flavour, because it is a looser fit with Venice.

### 1.2 Reference buildings

| Building | Date (source) | What makes it recognisable | Role in the track |
|---|---|---|---|
| Doge's Palace (Palazzo Ducale) | Mostly 14th c., rebuilt after 14th-c. fires [S1] | Open Gothic loggias, heavy tracery, quatrefoil openings, white Istrian stone against coloured marble [S1, S2] | HQ |
| Ca' d'Oro | c. 1421–40; sources disagree on dates [S4] | Best-surviving Venetian Gothic palazzo; ogee-headed windows with relief ornament; quatrefoil row on the upper balcony; gold leaf and polychrome once [S4] | Main palazzo facade |
| Ca' Foscari (Palazzo Foscari) | Late Venetian Gothic [S1] | Gothic palazzo on the Grand Canal | Palazzo variant |
| Madonna dell'Orto (church) | Mostly 14th c.; facade 1460s [S1] | Plain brick Gothic church | Brick church |
| Santi Giovanni e Paolo | Begun c. 1333, consecrated 1430 [S1] | Large brick Gothic church, pointed windows | Tall church or campanile |
| Frari | First built 13th c., rebuilt 14th–15th c. [S1] | Brick Gothic church | Alternate church |
| Scala Contarini del Bovolo | Most sources 1499 [S9] | Open spiral stair wrapping a cylinder, with loggias; Gothic-Renaissance; architect disputed | Stair-tower set piece |
| Porta Magna, Arsenale | 1460 [S10] | Gothic-to-Renaissance gate; winged victories added after 1571 [S10] | Gated entrance |
| Rialto Bridge | Built 1588–1591 [S5] | Single stone arch, Istrian stone | Upper bridge |
| Bridge of Sighs | Usually c. 1600 [S6] | Fully enclosed, small barred windows, white Istrian limestone | Tunnel mouth |
| Hotel Excelsior, Lido | Opened 1908 [S11] | Moorish-Venetian fantasy with Art Nouveau interiors | Garden-side building |
| Hotel des Bains, Lido | 1900 or 1908; disputed [S12] | Art Nouveau reading room; setting of *Death in Venice* [S12] | Garden-side building |
| Campanile di San Marco | 98.6 m (sources give 97–99 m); fell 1902, rebuilt 1912 in original form [S8] | Tallest landmark, skyline anchor | Skyline |

### 1.3 Features to model

| Feature | What the sources say | Low-poly note |
|---|---|---|
| Ogee-headed windows | The iconic Venetian Gothic element; ornament in relief on the head [S1, S4] | Arch cut-out or stacked boxes |
| Pointed-rim arches | Round arches sprout points on the outer rim and stay round inside [S1] | Same as ogee |
| Quatrefoil openings | Set above the loggia tracery [S1] | A texture decal on a flat panel, not geometry |
| Lancet windows | **Not in the Venetian source I read.** Lancets are more typical of northern Gothic (my knowledge). Don't make them the signature | Skip |
| Polychromy | Brick base, Istrian stone grander facades, coloured stone and marble veneers, patterned plain walls [S1, S2] | Banding textures, not extra meshes |
| Loggias | Closely spaced small columns, heavy tracery [S1] | Instanced columns |
| Roofline and crenellations | Decorative roofline; some rooflines have purely decorative crenellations, with Islamic-influenced detail [S1] | Thin trim strip |
| Chimney pots (fumaioli) | Truncated inverted cone; the shape is tied to fire risk in timber-era buildings [S16] | One tapered cylinder, instanced |
| Altane (roof terraces) | Wooden platforms on pillars, with wood or iron balustrades [S16] | Instanced platform on the roof |
| Water gates | Ground-floor water entrances to palazzi (my knowledge, not checked here) | Arch on the waterline |
| Mooring poles (paline, pali da casada) | Painted poles at palace fronts; the pali carry family colours [S16]. Sources disagree on whether paline are mooring poles | Treat as palace-front markers |
| Bricole | Groups of 2–3 wooden poles marking navigable channels [S16] | Instanced cluster along the kerb |
| Marmorino stucco | Traditional finish, sometimes on exteriors [S1] | Plaster texture |

**Proportions.**

| Item | What the sources give | Source |
|---|---|---|
| Grand Canal width | 30–90 m (Wikipedia mirror); 30–70 m (Britannica). Varies along its length | [S15] |
| Grand Canal length | About 3.8 km (mirror); "just over 3 km" (Britannica) | [S15] |
| Grand Canal depth | About 5 m average | [S15] |
| Rialto span, rise, height, deck width | Span 28.8 m; rise 6.4 m; height 7.32 m; deck 22.9 m (structural database) | [S5] |
| Rialto underside clearance | About 6 m (one source only) | [S5] |
| Bridge of Sighs | About 11 m (most sources; one calls it width, not length) | [S6] |
| Ponte della Libertà | 3,850 m long, 22 m wide, built 1931–33 | [S7] |
| Campanile | 98.6 m | [S8] |

**Not found:** storey heights, window spacing, and building width and height. I did not find a sourced figure for any of these, so I have not supplied one. The only qualitative point is that the piano nobile, the principal floor, has the largest windows and balconies [S22]. Measure from a survey drawing of a real facade before fixing the in-game scale. For planning only, not measurement: a storey of about 3–3.5 m (est.), a four-storey palazzo of about 14–18 m (est.).

---

## 2. Materials and colours

### 2.1 Palette

| Role | Hex | Basis |
|---|---|---|
| Istrian stone, fresh | `#E9E4D8` | Fresh stone is near-white or pale yellow [S2] (hex est.) |
| Istrian stone, weathered | `#A9A49A` | Weathers to pale grey [S2] (hex est.) |
| Venetian brick | `#A4472E` | Brick was the normal wall material [S1] (hex est.) |
| Weathered brick | `#7A4A3A` | (est.) |
| Ochre plaster | `#D9B98A` | Marmorino-style finish [S1] (hex est.) |
| Verona red accent | `#9B3B3B` | Reddish Verona stone used for contrast [S1, S2] (hex est.) |
| Roof-tile terracotta | `#B5583A` | (est.) |
| Lagoon water | `#5B7A7A` | Green-grey, (est.) |
| Canal shadow | `#2E4A52` | (est.) |
| Garden green | `#4E7A3A` | (est.) |

### 2.2 PBR sets

Every surface needs a real photo-based PBR set (project rule). I opened each Poly Haven page, and all are CC0.

| Use | Set | Link | Resolutions | Note |
|---|---|---|---|---|
| Red brick walls | Mixed Brick Wall | https://polyhaven.com/a/mixed_brick_wall [F] | 1K–8K | Weathered red, white and black bricks; a good Gothic brick church |
| Yellowed brick | Yellow Bricks | https://polyhaven.com/a/yellow_bricks [F] | 1K–8K | Lighter brick option |
| Plaster facades | Damaged Plaster | https://polyhaven.com/a/damaged_plaster [F] | 1K–16K | Plaster over brick; the closest match to weathered Venetian stucco |
| Plaster over brick | Plaster Brick Pattern | https://polyhaven.com/a/plaster_brick_pattern [F] | 1K–16K | Good for plain facades |
| Ashlar stone (Istrian trim) | Medieval Blocks 03 | https://polyhaven.com/a/medieval_blocks_03 [F] | 1K–8K | Regular blocks, **stone colour not stated; check before using as Istrian** |
| Rubble and foundations | Stone Wall | https://polyhaven.com/a/stone_wall [F] | 1K–8K | Rough rubble, not ashlar |
| Dark wet base | Stone Brick Wall 001 | https://polyhaven.com/a/stone_brick_wall_001 [F] | 1K–16K | Dark; for water-level bases |
| Clay roof tiles | **None verified on Poly Haven or ambientCG** | See below | | |

**Roof tiles and ambientCG.** The ambientCG listing page returned no assets when I opened it [S25]. Third-party sources say ambientCG is CC0, but I could not confirm any ambientCG asset ID for terracotta, brick or roof tiles. The nearest candidate is ShareTextures "Roof 26" (https://www.sharetextures.com/textures/roof/roof-26 [F]): a damaged clay roof tile, 4K only, and the page says CC0. It is not on the two libraries you named, so verify its licence page before use.

**Verdigris or copper.** No verified set found.

---

## 3. Landmark set pieces

| Part of draft | Options | Recommendation | Why |
|---|---|---|---|
| Tunnel under the upper section | Enclosed Bridge of Sighs form [S6]; covered sottoportego passage (my knowledge) | **Bridge of Sighs form** at the tunnel mouth | Enclosed, short, barred windows: boxes with arch cut-outs, very cheap in low poly |
| Raised upper section and its bridge | Rialto arch (span 28.8 m, rise 6.4 m, height 7.32 m) [S5]; Ponte della Libertà, a long flat causeway (3,850 m) [S7] | **Rialto-type arch** | A single arch is a ready shape. The roughly 6 m clearance (one source) leaves room for a road beneath |
| HQ, top left | Doge's Palace [S1]; Ca' d'Oro [S4] (a private palace, smaller); Porta Magna [S10] (a gate) | **Doge's Palace style** (loggia facade, two-tone stone) | Large, reads from a distance, and suits a civic HQ. Porta Magna can be the gated entrance |
| Lake | No inland lake; the lagoon is the only real open water [S15] | **Lagoon-shaped blue basin**, marked as fiction | Honest to Venice and cheap to build |
| Garden | Querini Stampalia garden by Scarpa, 1961–63: stepped copper basin, Istrian channel with two labyrinths [S13]; Napoleonic gardens, 1807, with pines at the east edge [S14] | **Querini Stampalia-style garden** (stepped basin and labyrinth) | Clean geometry that reads at speed. Its dimensions are not in the sources |

---

## 4. Street furniture and scenery

| Item | Status | Note |
|---|---|---|
| Gondolas | Not researched | A generic boat type, low trademark risk (my judgement) |
| Wellheads in squares | Not researched | Common in Venetian campi (my knowledge) |
| Vaporetto stops | Not researched | Don't copy the operator's livery (my judgement) |
| Market stalls, awnings, café terraces, flags | Not researched | Keep generic |
| Winged lion of St Mark | Venice's emblem; the Biennale used the lion as its own emblem before its 2001 identity [S29] | Use as a carved motif, not the Biennale logo |
| Cypress and umbrella pines | Pines in the Giardini, at the Pineta di Sant'Elena [S14]. No cypress in the sources; Lido trees not checked | Use pines in the garden |

**Trademark and licence notes.**
- The Biennale's name and logo are controlled [S21]. Don't use them, and don't use Venice Film Festival marks (not checked).
- Hotel names (Excelsior, Hotel des Bains) are real businesses. Use fictional names and signage.
- The Regata Storica is flavour only. Don't use its official logo.
- Per project memory, no placeholder people or props.

---

## 5. Racing and lighting

**Motorsport.** I found no verified history of a motor-racing circuit in Venice or on the Lido. The Automotive Masterpieces tag pages list a "Circuito Lido Venezia", a "Rally Internazionale Lido Venezia" and a "Concorso Eleganza Lido Venezia" [S20], but they give no verified dates or layouts. Don't cite a Venice Grand Prix: the 1915 event in the results was in Venice, California [not used].

**Regata Storica.** Held on the first Sunday of September on the Grand Canal [S17]. It opens with a parade of historic boats and includes a gondolino race that turns at a mid-canal post [S17]. The 2025 edition was on 7 September [S17]. The 2026 date (6 September) is my inference from the first-Sunday rule. This is good flavour for a start-finish parade.

**Day.** Lagoon water reads mirror-like, and boats leave light trails [S19]. Keep the water calm and reflective.

**Dusk.** Golden hour is the best window, followed by the blue hour just after sunset [S19]. Warm light on the palazzi and campanile, with coloured reflections on the water, fits the dusk look. Lamp and lantern colours are my suggestion, not sourced.

**Lagoon horizon.** Flat water with campanile silhouettes [S8, S18]. Dolomites: one source puts Marmolada about 100 km north-north-west, visible on a clear day [S18]. Another gives 130–150 km [S18]. A forum thread disputes visibility [S18]. Use only faint, far, and on the day look.

---

## 6. Environment beyond the track

- **Far backdrop:** the lagoon horizon with a campanile skyline, anchored by the Campanile di San Marco at 98.6 m [S8].
- **Dolomites:** faint and distant, day look only.
- **Dusk:** the horizon fades to deep blue, with campanile lights. My suggestion, not sourced.

---

## 7. Recommended direction

- **Style mix:** about 60% Venetian Gothic (palazzi, brick churches), about 20% Renaissance and Baroque (Bovolo stair, Porta Magna, Rialto, Bridge of Sighs), about 10% Byzantine accents, about 10% Lido Liberty on the garden side (my judgement).
- **Victorian note:** frame the track as Ruskin's Venice. Add British revival only if the user asks.
- **Top 5 building types to model:** (1) Venetian Gothic palazzo with ogee windows, loggia and polychrome banding; (2) brick Gothic church with a tall campanile; (3) spiral-stair tower (Bovolo type); (4) Lido Art Nouveau hotel; (5) crenellated Arsenale-style gate.
- **HQ:** Doge's Palace style (Gothic loggia facade) for the top-left HQ. Porta Magna for the gated entrance.
- **Crossover:** Rialto-type stone arch as the upper bridge, with an enclosed Bridge of Sighs form as the tunnel mouth.
- **Garden and lake:** a Querini Stampalia-style stepped basin and labyrinth for the garden; a lagoon-shaped blue basin for the lake, marked as fiction.
- **Materials:** Poly Haven brick, plaster and stone sets from section 2, with the Istrian palette. Medieval Blocks 03 needs a colour check. Clay roof tiles still need a verified CC0 source (ShareTextures Roof 26 is a candidate).
- **Lighting:** day for calm water and faint Dolomites; dusk for warm palazzi and coloured reflections, with cool blue at the horizon.
- **Avoid:** Biennale and Film Festival logos or names, real hotel names, vaporetto livery, and any claim of a real Venice Lido circuit.
- **Verify before modelling:** storey heights and window spacing. No source found. Measure from survey drawings.

---

## Unverified or weak

- Storey heights, window spacing, and building width and height: no source found.
- Venice Lido racing circuit: no verified history.
- Ca' d'Oro dates differ across sources (c. 1421–40).
- Hotel des Bains date: 1900 or 1908.
- Rialto span: the Wikipedia infobox gives 31.8 m, the structural database 28.8 m. I used 28.8 m.
- Bridge of Sighs: one source gives width where others give length.
- Pali function: sources disagree.
- Lancet windows: not in the Venetian source.
- Roof tiles: no Poly Haven or ambientCG set verified; ShareTextures Roof 26 is unverified beyond its page.
- Garden dimensions (Querini Stampalia): not in the sources.
- All hex values are my art-direction targets, not measurements.
- The Regata Storica 2026 date is my inference.

---

## Sources

**Architecture and history**
- [S1] Venetian Gothic architecture, Wikipedia [F]: https://en.wikipedia.org/wiki/Venetian_Gothic_architecture
- [S2] Istrian stone, Wikipedia [F]: https://en.wikipedia.org/wiki/Istrian_stone
- [S3] Ruskin, *The Stones of Venice*, vol. 1, Project Gutenberg [S]: https://www.gutenberg.org/ebooks/30754
- [S4] Ca' d'Oro, Wikipedia [S]: https://en.wikipedia.org/wiki/Ca%27_d%27Oro
- [S5] Rialto Bridge, Wikipedia [S]: https://en.wikipedia.org/wiki/Rialto_Bridge ; Structurae: https://structurae.net/en/structures/rialto-bridge
- [S6] Bridge of Sighs, Structurae [S]: https://structurae.net/en/structures/bridge-of-sighs
- [S7] Ponte della Libertà, Wikipedia [S]: https://en.wikipedia.org/wiki/Ponte_della_Libert%C3%A0 ; Structurae: https://structurae.net/en/structures/liberty-bridge-1933-venice
- [S8] St Mark's Campanile, Wikipedia [S]: https://en.wikipedia.org/wiki/St_Mark%27s_Campanile
- [S9] Palazzo Contarini del Bovolo, Wikipedia [S]: https://en.wikipedia.org/wiki/Palazzo_Contarini_del_Bovolo
- [S10] Arsenale of Venice, Venice Welcome [S]: https://www.venicewelcome.com/info/monuments_of_venice/naval_academy_arsenale.htm
- [S11] Hotel Excelsior review, On Magazine [S]: https://www.on-magazine.co.uk/travel/hotel-reviews/venice-and-the-excelsior
- [S12] Hotel des Bains, MAG1861 [S]: https://www.mag1861.it/en/news/articolo/hotel_des_bains_lido_venice_festival_cinema-17985887
- [S13] Querini Stampalia garden, Archeyes [S]: https://archeyes.com/fondazione-querini-stampalia-carlo-scarpa-in-venice/ ; Electa: https://electa.it/en/product/carlo-scarpa-la-fondazione-querini-stampalia-a-venezia-2
- [S14] Giardini della Biennale, La Biennale [S]: https://www.labiennale.org/en/venues/giardini-della-biennale ; Napoleonic gardens: https://venetoaroundme.regione.veneto.it/en/node/128479
- [S15] Grand Canal, Britannica [S]: https://www.britannica.com/print/article/241163 ; Wikipedia mirror: https://wikiwand.com/EN/Grand_Canal_of_Venice
- [S16] Chimneys and roof terraces, Images of Venice [S]: https://imagesofvenice.com/?p=9872 ; Canal poles: https://imagesofvenice.com/canal-poles/
- [S17] Regata Storica, Images of Venice [S]: https://imagesofvenice.com/?p=15280
- [S18] Dolomites from Venice: https://traseo.com/map/135/marmolada-italy-adventuremapping [S] ; Fodor's forum: https://www.fodors.com/community/europe/venice-and-the-dolomites-543865/ [S] ; Campanile view: https://www.photohound.co/spot/1844 [S]
- [S19] Venice photography guide, VeniceXplorer [S]: https://venicexplorer.com/the-city/blog/the-ultimate-venice-photography-guide-top-tips-for-capturing-the-floating-city
- [S20] Motorsport tag pages, Automotive Masterpieces [S]: https://automotivemasterpieces.com/tags/CircuitoLidoVenezia
- [S21] Biennale legal notes [S]: https://www.labiennale.org/it/note-legali
- [S22] Piano nobile, Wikipedia [S]: https://en.wikipedia.org/wiki/Piano_nobile
- [S25] ambientCG listing for "terracotta" [F, no assets returned]: https://ambientcg.com/list?type=PhotoTexture,Material&q=terracotta
- [S29] Venice Biennale identity case study, Inarea [S]: https://inarea.com/en/case-study/the-venice-biennale/

**Textures (CC0, opened on Poly Haven)**
- [F] Mixed Brick Wall: https://polyhaven.com/a/mixed_brick_wall
- [F] Yellow Bricks: https://polyhaven.com/a/yellow_bricks
- [F] Damaged Plaster: https://polyhaven.com/a/damaged_plaster
- [F] Plaster Brick Pattern: https://polyhaven.com/a/plaster_brick_pattern
- [F] Medieval Blocks 03: https://polyhaven.com/a/medieval_blocks_03
- [F] Stone Wall: https://polyhaven.com/a/stone_wall
- [F] Stone Brick Wall 001: https://polyhaven.com/a/stone_brick_wall_001
- [F] ShareTextures Roof 26 (not Poly Haven; licence to verify): https://www.sharetextures.com/textures/roof/roof-26
</content>
