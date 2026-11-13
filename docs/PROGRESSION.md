# Garage progression draft

All 14 cars remain available. `assets/teams/progression.json` owns the rank ladder, required levels, fictional team histories and `testingUnlockAll` switch. These are authored progression tiers based on stock performance and character, not a lap-time leaderboard or claims about the real manufacturers.

| Rank | Required level | Cars |
|---|---:|---|
| D · Club | 1 | ST–6, Veloce Aero |
| C · Sport | 5 | Continental GT |
| B · Pro | 10 | 911–T |
| A · Elite | 15 | Furari 488-R, McLaren 650S GT3, AV–12, Blackbird-X |
| S · Hyper | 20 | Mercedes-AMG One, Divo-X |
| S+ · Apex | 25 | Valkyrie, Destrier-X |

Saetta are serial winners; Corvid former champions; Mojave fallen greats; Aurum defending champions; Liberty a rookie team with experienced drivers; Sarab rising contenders. Team history does not grant access: each car has its own required level.

The garage shows ranks, required levels, player level, testing access and team history. Car selection and session start share the access rule. Existing saves without `playerLevel` read as level 1. Previewing locked cars is allowed. AI opponents are not restricted by the player's level.

Before launch, implement and tune XP awards and saved player-level advancement, playtest tier balance, then set `testingUnlockAll` to false. No XP or career rewards are awarded by this placeholder. Upgrade levels are separate from player level. Run `node scripts/test-progression.mjs` from `track-viewer` for roster coverage and locked/unlocked level-boundary tests.
