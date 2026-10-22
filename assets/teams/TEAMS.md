# Ultrack teams and drivers

Seven fictional race teams own the grid, each with two cars and two drivers, like F1 constructors (fourteen cars; a race runs one car per team, so seven). `teams.json` holds the data the game reads:
- per team: id, name, three-letter code, colours (plus an optional text colour, `ink`, for a team whose accent is too pale to read on its primary), an optional light colour (`light`), display font, paint finish, livery brief and pit boxes;
- per car: its key and race number;
- per driver: name, broadcast code, nationality, age, role, a one-line bio, background, personality and rivals (driver codes).

Team and driver names are fictional. Real sponsor artwork is used in this local fan project; see ../sponsors/README.md for sources.

## Teams

All seven teams have original emblems and outlined wordmarks, exported as SVG
masters plus transparent PNG/WebP textures. Team, dark-background and
light-background variants are available as horizontal lockups and standalone
emblems. See [logo documentation](logos/README.md) and the live gallery at
http://127.0.0.1:5180/team-brand-guide.html. Cars, venue team surfaces and menu
cards reuse these assets. Sponsor artwork is separate from the team identities.

| Team | Code | Meaning | Home | Principal | Sound |
|---|---|---|---|---|---|
| **Saetta** | SAE | Italian: a lightning bolt | Modena | Vittoria Saldani | flat-plane V8 (Furari) / V12 hybrid (La Furari) |
| **Toro** | TOR | Italian: the bull | Sant'Agata Bolognese | Ettore Montanari | V12 (AV–12) / V10 (HU–10) |
| **Corvid** | COR | the raven and crow family | Silverstone | Sir Hugo Ravensworth | V12 (Valkyrie) / W12 (Bentley) |
| **Mojave** | MOJ | the desert it was built in | Barstow, CA | Cal Beaumont | F1 hybrid V6 (AMG One) / twin-turbo V8 (AMG GT4) |
| **Aurum** | AUR | Latin: gold | Monaco | Helene Aurelle | W16 (the two Bugattis) |
| **Liberty** | LIB | English: freedom; the cracked bell of Philadelphia | Philadelphia, PA | Harlan Whitfield | V8 / W16 (Mustang and Blackbird) |
| **Sarab** | SRB | Arabic: a mirage (the home team) | Corniche Marina | Rashid Al-Mansouri | V8 / flat-six |

Each team pairs cars of one character, usually with one engine sound, so the team reads and sounds like a unit. Seven teams and seven trackside sponsors besides the tyre supplier: one title sponsor each.

## Saetta and Toro: the two Italian houses

Thirty-five kilometres of Via Emilia separate the red team from the yellow one, and they have not shared a kind word in sixty years.

**Saetta** (Modena, founded 1947, principal Vittoria Saldani, granddaughter of the founder) is the Ferrari team: rosso, gold and a lightning bolt, a trophy-laden factory dynasty that expects to win and treats every season without a title as a reckoning. Its two cars are the Furari 488-R (#17, Sofia Calderini, the calm one) and La Furari (#27, Thiago Barreto, the showman), a flat-plane V8 and a V12 hybrid. Saldani runs the garage like an opera house: lots of shouting, and somehow it always ends beautifully. Its line is *Lightning strikes first.*

**Toro** (Italian for the bull; Sant'Agata Bolognese, founded 1963, principal Ettore Montanari) is the Lamborghini team. In 1963 Alvise Montanari, who built tractors and grain pumps in a shed outside Sant'Agata, bought a Saetta road car; the clutch failed inside a month. He drove the 35 km to Modena to say so in person, and Saetta's founder told him a tractor man should leave motor cars to people who understood them. Montanari went home, fitted the next car with a clutch from his biggest tractor and a V12 of his own design, and named it after a fighting bull. The bull on the badge is the one that lived in the field beside the shed, and that, the story goes, once stood in the Via Emilia and held up a Saetta transporter for six hours. Sixty-three years on, the shed is a factory and the grudge is still on the payroll. His grandson Ettore, who spent his twenties on the factory floor and his thirties arguing with Saetta in public, now runs the team.

What Toro stands for: noise, honesty and over-engineering. Naturally aspirated engines, no apologies, parts built to survive a farm. Its cars are the AV–12 (#7, a V12) and the HU–10 (#63, a V10, numbered for the year of the founding), and the team's lettering is Unbounded Black, a wide, heavy face that looks like it came off a tractor bonnet. Its line is *Nobody herds the bull.* Its sponsor is Red Bull, a coincidence the team's press office no longer comments on.

**The rivalry.** Saetta's founder never took back what he said, and Toro has spent sixty-three years proving him wrong in public, one clutch at a time. The two crews drink in different bars in the same village (San Cesario sul Panaro, halfway between the factories) and have never swapped a spanner. Last season the series organisers forced a one-year truce, the Via Emilia accord: Saetta ran a Toro-built AV-12 as a guest car beside its own Furari, with its own academy driver, Matteo Varrone, at the wheel. When the accord ended the car went home to Sant'Agata, and Varrone, who had fallen in love with it, went with it. Saetta's tifosi still whistle him; he answers by kissing the lightning bolt on his helmet before every start. Toro's second seat belongs to Paloma Ortega, a matador's daughter who lets the bull charge and steps aside at the last metre.

## Drivers

| # | Driver | Code | Nation | Team | Car | In one line |
|---|---|---|---|---|---|---|
| 1 | Remy Valois | VAL | MON | Aurum | Bugatti Divo | reigning champion |
| 3 | Zayn Kareem | KAR | UAE | Sarab | McLaren 720S | home hero |
| 4 | Theo Ashcombe | ASH | GBR | Corvid | Valkyrie | third-generation racer |
| 7 | Matteo Varrone | VAR | ITA | Toro | AV–12 | Toro's prodigal son |
| 8 | Freya Lindqvist | LIN | SWE | Mojave | Mercedes-AMG One | rally convert |
| 9 | Rosa Quintero | QUI | MEX | Mojave | Mercedes-AMG GT4 | rookie |
| 16 | Armand Beaulieu | BEA | FRA | Aurum | Bugatti Destrier | the gentleman racer |
| 17 | Sofia Calderini | CAL | SUI | Saetta | Furari 488-R | the calm one at Saetta |
| 27 | Thiago Barreto | BAR | BRA | Saetta | La Furari | the showman |
| 33 | Layla Qasimi | QAS | OMN | Sarab | 911–T | the overtaker |
| 44 | Kai Whitlow | WHI | NZL | Corvid | Continental GT | the grid's veteran |
| 63 | Paloma Ortega | ORT | ESP | Toro | HU–10 | the matador |
| 66 | Cole Maddox | MAD | USA | Liberty | Mustang ST–6 | the brawler |
| 76 | Wade Hollis | HOL | USA | Liberty | Hennessey Blackbird | the Colonel |

The three-letter codes are for the timing tower and on-screen graphics. The numbers go on the cars (Toro's #63 is the year its founder started the works). Fourteen drivers, thirteen nations (two Americans at Liberty).

## Driver profiles

What the commentators riff on. The data is in teams.json (age, role, background, personality, rivals).

- **Matteo Varrone** (VAR, ITA, 26, Toro #7), Toro's prodigal son. Born in Modena, son of a Saetta machinist; in the Saetta academy from fourteen. Drove the AV-12 that Toro lent Saetta for a season under the Via Emilia truce; when the loan ended and the car went home to Sant'Agata, he went with it. Hot-blooded on the radio, adored by Toro's faithful and whistled by Saetta's tifosi; kisses the lightning bolt on his helmet before every start, and nobody at Toro dares ask him to peel it off. Rivals: Theo Ashcombe, Sofia Calderini, Thiago Barreto.
- **Sofia Calderini** (CAL, SUI, 27, Saetta #17), the calm one at Saetta. From Lugano, in Italian-speaking Switzerland; karting world champion at seventeen, then studied architecture before Saetta called. Plays chess with her engineers between sessions; her heart rate on the grid is famously low; out-qualified Varrone when he was her teammate and has never mentioned it. Rivals: Matteo Varrone, Paloma Ortega.
- **Thiago Barreto** (BAR, BRA, 34, Saetta #27), the showman. Three-time Stock Car Brasil champion from Curitiba, who swept the kart track his uncle ran before he ever raced on it; Vittoria Saldani signed him on a restaurant napkin the week Varrone left. Dances on the grid and sings opera arias, badly, over the team radio on the formation lap (Saldani adores it); signs every autograph with a lightning bolt; determined to prove Saetta never needed Varrone. Rivals: Matteo Varrone.
- **Paloma Ortega** (ORT, ESP, 32, Toro #63), the matador. From Seville; her father fought bulls for twenty years and she grew up in the bullring's stable yard before running away to karts at twelve; European GT champion when Toro signed the one driver who would not charge. Ice-cold and patient: she lets the others charge, then steps aside at the last metre of the braking zone. Hates the headline nickname 'La Torera' and has stopped correcting it. At a team called the bull, Varrone is the bull and she is the matador, and both know it. Rivals: Sofia Calderini (the two coldest heads on the grid, on the two warmest teams).
- **Theo Ashcombe** (ASH, GBR, 24, Corvid #4), third-generation racer. Grandfather raced at Silverstone, father ran Corvid's test team; grew up in the paddock. Writes a handwritten apology note after every collision, then does it again; a running feud with Varrone since they touched at the Corniche hairpin. Rivals: Matteo Varrone.
- **Kai Whitlow** (WHI, NZL, 38, Corvid #44), the grid's veteran. Grew up on a sheep station in Canterbury, New Zealand; three endurance class wins before Corvid signed him. The Metronome: lap times within a tenth for hours; surfs between races; quietly mentors the rookies, even on other teams.
- **Cole Maddox** (MAD, USA, 30, Liberty #66), the brawler. From Bakersfield, California; sprint cars and dirt ovals from age nine, until Liberty's Harlan Whitfield flew in to watch him win a county-fair dirt race and signed him on the spot. The most penalised driver in the paddock; cowboy boots, no filter, big heart; the stewards know number 66 by heart; he and teammate Hollis cannot agree on who is the real American. Rivals: Freya Lindqvist, Wade Hollis.
- **Rosa Quintero** (QUI, MEX, 20, Mojave #9), rookie. From Monterrey; sim-racing world champion who won her seat in Mojave's esports shootout. Frighteningly fast over one lap, still learning racecraft in traffic; the youngest driver on the grid and openly out to beat Valois. Rivals: Remy Valois.
- **Remy Valois** (VAL, MON, 31, Aurum #1), reigning champion. Born in Monte Carlo, son of a yacht broker; two titles with Aurum. Never raises his voice on the radio; listens to old jazz on the grid; his charm is half the psychology. Rivals: Zayn Kareem, Rosa Quintero, Armand Beaulieu.
- **Armand Beaulieu** (BEA, FRA, 36, Aurum #16), the gentleman racer. From Lyon, the son of a silk merchant; a decade of endurance prototypes and three Le Mans class podiums before Aurum gave Valois a teammate he could not charm. Dresses for the grid as if for a gala; calls Valois 'le Prince' to his face; collects vintage watches; never swears, but his sigh on the radio is worse. Rivals: Remy Valois, Zayn Kareem.
- **Freya Lindqvist** (LIN, SWE, 29, Mojave #8), rally convert. From Värmland, Sweden; forest rallies and ice racing on frozen lakes until Cal Beaumont watched her slide a car across one and offered her a seat at Mojave. Deadpan; says grip is overrated and means it; the brawler Maddox's great rival (she slides the car, he shoves it); the one person at Mojave who has never been impressed by the barn. Rivals: Cole Maddox.
- **Wade Hollis** (HOL, USA, 37, Liberty #76), the Colonel. From Abilene, Texas; fourteen years as an air-force test pilot before a charity race showed he was faster on the ground. Speaks in checklists and calls corners 'waypoints'; unflappable on the radio; flies himself to every race in a vintage trainer; he and teammate Maddox cannot agree on who is the real American. Rivals: Cole Maddox.
- **Zayn Kareem** (KAR, UAE, 27, Sarab #3), home hero. Grew up on the Corniche; powerboat racer on the marina as a teenager before Sarab put him in a car. Carries a whole city's expectations; generous with fans; wants Valois's crown, and knows his teammate is often quicker. Rivals: Remy Valois, Layla Qasimi.
- **Layla Qasimi** (QAS, OMN, 25, Sarab #33), the overtaker. Learned to drive on graded desert roads near Oman's Wahiba Sands in her uncle's pickup; Sarab signed her after her first season in club racing. Fearless and cheerful; holds the record for passes in a single race; friendly rivalry with teammate Kareem that splits the crowd. Rivals: Zayn Kareem.

## Liveries

Built in `track-viewer/src/livery.js` from this file. Every car carries its number on both doors and on the roof, the driver's name and nation under the side window, the team's title sponsor (`sponsor`) on the rear quarter and the rear deck, the series tyre supplier (Kestrova) on the sill and the rear, two smaller trackside brands on the door, the Ultrack series logo on the front wing, the team name on the bonnet, the rear deck and the rear bumper band, and the team's graphic described below. Each team's `livery` field is the brief for its decals: one base colour, one graphic motif that carries the team's story, the number roundel, and sponsor slots on the doors, bonnet and rear wing. The two cars of a team share the scheme; only the number and the driver's name change.

### Saetta (the Ferrari team)

Rosso (#c8102e), gold (#f2b705) and bone white, in **Racing Sans One**. On the car: a single gold lightning bolt fractures along each flank from the front wheel to the rear haunch, a tricolore tab sits on the mirror caps, and the numbers are gold in a white roundel. The two cars, the Furari 488-R (#17) and La Furari (#27), share the scheme.

### Toro (the Lamborghini team)

Giallo yellow (#ffd60a), nero black (#0d0e10) and bone white (#f4f1e8), in **Unbounded Black** (SIL OFL, `track-viewer/public/assets/fonts/unbounded-OFL.txt`; the lettering is outlined into the logos, and Blender sets the transporter and motorhome names from `assets/teams/fonts/Unbounded-Black.ttf`). The emblem is a charging bull's head, angular and original. On the car: two black horn blades flare apart from the front wheel along each flank, one climbing to the shoulder, one dropping to the sill, each edged in a bone-white line; a broad black stripe over the roof between two white pinstripes; the number in a black roundel with a bone ring and yellow digits. Yellow is too pale for white lettering, so the team sets `colors.ink` (black) for the text that sits on its primary: the driver's name on the door and the banner copy. The AV–12's carbon roof and bonnet are the model's own, so the roof stripe only shows on a car with a painted roof. Toro has no `light` colour: its garage header, banner and pit panel are plain yellow and black. Its cars: the AV–12 (#7) and the HU–10 (#63).

### Liberty (the American team)

Royal blue (#1f46b8), Old Glory red (#bf0a30) and white, in **Graduate**, a varsity slab (SIL OFL, `track-viewer/public/assets/fonts/graduate-OFL.txt`). On the car: a red-white-red stripe trio streams back from the front wheel on each flank like a flag in wind, a field of seven white stars on the front fender, red and white racing stripes over the roof, and a thin royal-blue light line along the beltline. Its `light` colour, royal blue (#3d6bff), is the team's lighting: the garage header is a lit panel with a glowing blue edge, the pit box floor is bordered in it, and the Corniche Club banner has glowing blue side strips (`track-viewer/src/teamdress.js`). The team's cars: the Mustang (#66) and the Hennessey Blackbird (#76).

Mojave now runs both Mercedes: Lindqvist (#8) in the AMG One and Quintero (#9) in the AMG GT4, in desert orange and navy sunburst; the Bentley went home to Silverstone as Whitlow's Corvid car (#44), so Corvid is all-British; the two Bugattis (Divo #1 and Destrier #16) are **Aurum**'s.

## Pit boxes

The marina pit lane has 12 boxes for 14 cars. **Aurum** (1-2), **Saetta** (3-4), **Toro** (5-6, next door to its rival) and **Sarab** (7-8, the home team, moved down two) keep two boxes each; **Corvid** has boxes 9-10 (the two freed by Kalt's departure), **Mojave** box 11 and **Liberty** box 12. So two second cars have no parked slot and stay out of the pit lane unless racing: Mojave's AMG GT4 (#9) and Liberty's Blackbird (#76). Fixing it means two more boxes in `tracks/marina/layout.py` and a track rebuild.

## Venue artwork

Garage headers, box floor panels, flags, trucks, hospitality units and the seven canopy banners of the Corniche Club follow this file; the seventh and eighth teams' pieces (Liberty, Toro) were added to the built venue by `tracks/marina/apply_teams.py`, which also hands every pit box to the team that owns it. Toro's banner hangs next to Saetta's, its hospitality unit stands next to Saetta's, and its flag flies twice in the plaza.

## Announcers

The booth script is assets/audio/announcers/SCRIPT.md. Enzo's lines (v2) and Kavya Iyer's paddock reports name the teams, principals and drivers above. Fourteen lines are retired in script.json (`when: "retired"`): eight said twelve drivers or six teams and wait to be recorded again for the current grid, one (`enzo.general_filler.01`, Varrone and "the Saetta engineers") is wrong now that he drives for Toro, and five (`enzo.intro_session.12`, `enzo.fastest_lap.04`, `enzo.rain_starting.02`, `enzo.general_filler.05` and `.06`) name Kalt's removed drivers Reiter and Tanabe. Kavya's line about Varrone kissing the lightning bolt on his helmet stays true, and now has a story behind it. No line yet names Toro, Thiago Barreto or Paloma Ortega: they need new recordings. Alastair's 184 lines name nobody. Event lines are about the player's car, so they name a driver only as a comparison ("Very Varrone!"), never as the one doing the move. Calling the actual car on air ("Varrone is through!") would still need a per-driver name set.

## To decide

Several car display names in the car-lab profiles echo real models (Valkyrie, Continental GT, Chiron-X, 911-T, XKSS). Next to fictional teams and drivers, they should get fictional model names too.
