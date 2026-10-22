// Builds script.json + SCRIPT.md for the Ultrack booth from the line data below.
const fs = require('fs');
const path = require('path');
const OUT = 'D:/RaceUltimate/assets/audio/announcers';

const speakers = {
  enzo: {
    name: 'Enzo Moretti',
    bio: 'Lead play-by-play. Grew up above his father\'s tyre shop near Parma and learned to drive delivering tyres too fast. Raced the Italian junior formulas in his teens; his best result was a soaking-wet second place, which he still describes lap by lap. A broken wrist at 22 ended the career, and he has spent the 25 years since in the commentary box. Loves bravery, late braking and night racing.',
    voice_notes: 'Italian man from Parma, early 50s, warm bright baritone. Speaks fluent English with an unmistakable Italian accent (open vowels, tapped r, Italian rhythm and melody), never British or American; the accent comes from the voice, not the spelling. Very expressive: laughs, chuckles, sighs, sarcasm and mock outrage, quick and energetic, rising to a full shout on big moments. Openly biased towards Saetta and pretends not to be. Italian words (allora, andiamo, bellissimo, mamma mia) are sparing and said naturally.',
  },
  alastair: {
    name: 'Alastair Finch',
    bio: 'Colour commentator. Eleven years on the pit wall as a race engineer for privateer endurance teams, where he counted fuel loads and was ignored by drivers. Now an amateur historian writing a very long history of forgotten circuits, and a restorer of old clocks (forty-one at last count) in a cottage full of ticking. Dry, withering and eloquent, theatrically appalled by clumsy driving, secretly devoted to the sport and to Enzo.',
    voice_notes: 'British man, early 60s, crisp received-pronunciation English, precise and unhurried, a long dry delivery with the occasional theatrical sigh. Grumpy rather than cruel; the warmth shows on wins and in the exchanges. Rarely raises his voice, so when he does it lands.',
  },
  kavya: {
    name: 'Kavya Iyer',
    bio: 'Paddock reporter. Grew up in Coimbatore, India\'s racing town, above her mother\'s motorcycle workshop, and won a national karting title at fifteen. Studied mechanical engineering in Chennai, then spent six years as a tyre engineer for junior teams in Europe, where she learned that drivers lie about tyres and engineers lie about everything else. Now she walks the paddock with a notebook of every driver\'s habits and superstitions. Quick, warm and teasing: the only person on the broadcast who can make Alastair laugh and Enzo stop talking.',
    voice_notes: 'Indian woman, early 30s, speaks fluent English with a clear, natural Indian accent (Indian English, South Indian lilt), never British RP and never American. Bright, quick and confident broadcast delivery with a smile in the voice; teasing and warm about the drivers, crisp rather than breathy.',
  },
};

// Enzo's text is v2 (enzo_lines.js, keyed by id); his strings below are the v1 lines, kept as the slot list.
const ENZO = require('./enzo_lines.js');

// [category, priority, cooldown_s, { when?, e: [...], a: [...] }] ; dialogue entries use d: [[speaker, text], ...]; Kavya's use k: [...] with subject
const E = 'enzo', A = 'alastair', K = 'kavya';
const data = [
  ['intro_session', 3, 0, [
    { when: 'free',
      e: ['Free Drive tonight. No grid, no pressure, just a car and an open circuit.',
          '[excited] Good evening! The whole circuit belongs to one driver. Go and find the limits, my friend.'],
      a: ['Free Drive. No points, no podium, and mercifully no excuses. Do learn the braking markers.',
          '[dryly] An empty circuit. The ideal place to make mistakes nobody will remember. Except me.'] },
    { when: 'race',
      e: ['Buonasera and welcome! Twelve cars, one finish line, and nobody here came to lose.',
          '[excited] Good evening, everybody! Race night, engines warm, and already I can smell the brakes.',
          'Welcome to the broadcast! Allora, the grid is set, and tonight somebody becomes a hero.'],
      a: ['Good evening. A full field, a short fuse, and a great deal of expensive carbon at risk.',
          'Welcome. I am told this will be a clean race. I have heard that before. Frequently.',
          'Good evening. Twelve drivers, and at least three of them believe brakes are optional.'] },
    { when: 'endurance',
      e: ['Welcome to the Endurance! Hours, not minutes. Pit stops, strategy, and tired eyes at the end.',
          'Endurance tonight, my friends. Fast is good, but the car must finish. Patience, and then, andiamo.'],
      a: ['Endurance. My natural habitat. Fuel, tyres, pit windows and the slow, exquisite agony of strategy.',
          'Good evening. Tonight we discover who can be quick for a very long time. Rarely the same person.'] },
    { when: 'dusk',
      e: ['Look at that sky, orange over the barriers. Bellissimo. Racing at dusk is something special.',
          'The sun goes down, the lights come on. For me, the perfect hour to race.'],
      a: ['Dusk. The light is gorgeous and utterly useless. Braking markers vanish straight into the glare.',
          'Low sun, long shadows. Every apex looks a yard further away than it really is.'] },
    { when: 'night',
      e: ['Blue hour turning into night, the city lights are on, and the cars look like comets.',
          'Night racing! Headlights, sparks, and the noise bouncing off every wall. I love it.'],
      a: ['Night. Depth perception leaves the building, and the barriers take full advantage.',
          'Blue hour. A painter would call it sublime. An engineer calls it reduced visibility.'] },
    { when: 'rain',
      e: ['[excited] Rain tonight! Mamma mia, this is where the brave ones show themselves.',
          'Wet track, spray everywhere. Gentle hands on the wheel tonight, or the car will bite.'],
      a: ['Rain. Grip is now merely a rumour. Whoever is smoothest will look like a genius.',
          '[sighs] It is raining. Somewhere a set of slick tyres is weeping. So am I.'] },
  ]],
  ['intro_track', 3, 0, [
    { when: 'corniche', d: [
      [E, 'Welcome to the Corniche Marina Circuit! Street racing along the seafront, yachts in the harbour, concrete walls on every side. Under the lights it is pure theatre, but touch a barrier here and your race is finished.'],
      [A, 'Narrow, bumpy, and lined with walls that have ended more promising evenings than I care to count. The marina section is the trick: brake by the water, not by your nerve. And do ignore the yachts. They are not looking at you.'] ] },
    { when: 'sahyadri', d: [
      [E, 'Tonight we are in the Western Ghats of India, for the Sahyadri Ghat Circuit. Hairpins cut into the mountain, mist in the valleys, and a long drop beside the road. Mamma mia, this place demands respect.'],
      [A, 'A proper mountain road, built for lorries and monsoons rather than racing cars. The hairpins arrive in clusters, the camber changes its mind halfway round, and the guardrail is the only friend you will have up there. Splendid.'] ] },
  ]],
  ['booth_backstory', 1, 900, [
    { d: [
      [E, 'I am Enzo Moretti. Twenty-five years in this booth, and before that, a kid in the Italian junior formulas, braking much later than was sensible.'],
      [A, 'Much later. I have seen the footage. Alastair Finch, by the way: former race engineer, and the current conscience of this commentary box.'] ] },
    { d: [
      [E, 'Beside me, Alastair Finch. Eleven years on the pit wall for endurance teams, and still he counts fuel in his sleep.'],
      [A, '[dryly] And beside me, Enzo Moretti, who finished second in a rainstorm twenty-eight years ago and has described every lap of it to me personally.'],
      [E, '[laughs] Every lap was worth describing!'] ] },
    { d: [
      [A, 'When I am not here, I am writing a history of forgotten racing circuits. Volume one runs to eight hundred pages.'],
      [E, 'Eight hundred pages, and he says I talk too much! Allora, he also restores old clocks. A very patient man. With clocks.'],
      [A, 'Clocks do not lunge up the inside at the hairpin, Enzo.'] ] },
  ]],
  ['grid_and_lights', 3, 0, [
    { when: 'formation',
      e: ['Cars rolling to the grid now. Tyres warming, hearts racing.',
          'Formation lap. Weaving, warming the tyres. Nearly time, andiamo.',
          'Everybody finding their slot. The tension, you can feel it.'],
      a: ['The formation lap. Twelve drivers pretending to be calm.',
          'Weaving to warm the tyres. Also, I suspect, to settle the stomach.',
          'Grid slots found. Now the only question is who flinches first.'] },
    { when: 'lights_on',
      e: ['The lights are coming on...',
          'First light... second... here we go!',
          '[whispers] Lights on. Everybody still. Waiting...'],
      a: ['Red lights. The longest seconds in motorsport.',
          '[dryly] Lights on. Clutches trembling. Nerves rather more so.',
          'Hold it... hold it... hold it...'] },
    { when: 'lights_out',
      e: ['[shouting] Lights out! Andiamo!',
          "[shouting] They're gone! The race is on!",
          '[shouting] Go, go, go! Twelve cars charging for turn one!'],
      a: ['And they are released. Mind the first corner, everyone.',
          'Away they go. Turn one awaits its victims.',
          "Lights out. Now let's see who has been practising."] },
  ]],
  ['race_start_good', 3, 0, [{
    e: ['[excited] What a launch! Clean off the line and gaining places!',
        'Perfect reaction! Straight past the cars ahead, bellissimo!',
        'Great start! Into turn one with all the momentum.',
        'Like a rocket off the grid! That is how you begin.'],
    a: ['A textbook getaway. The clutch work of a surgeon.',
        'Superb reaction time. Somebody was actually concentrating.',
        'Places gained before the first braking zone. Very tidy indeed.',
        'Now that is a start worth watching twice.'] }]],
  ['race_start_bad', 3, 0, [{
    e: ['Oh no, bogged down! Cars streaming past on both sides!',
        'Slow away! Far too much wheelspin there.',
        'A poor launch. Never mind, the race is long.',
        'Mamma mia, the start is gone! Time to fight back.'],
    a: ['[sighs] That getaway was more of a gentle departure.',
        'Wheelspin, then hesitation. A start to forget.',
        'Swamped. The field went past like commuters past a busker.',
        'Well. That is several places to win back, then.'] }]],
  ['overtake_player', 2, 6, [{
    e: ['[excited] Through! Up the inside, beautiful move!',
        'Late on the brakes, and the place is taken!',
        'Around the outside! Mamma mia, what courage!',
        "That's another one picked off. Andiamo!",
        'Clean pass. No contact, no drama. Perfect.'],
    a: ['Neatly done. Not a coat of paint exchanged.',
        'Committed, decisive, and frankly rather elegant.',
        'Dispatched. The victim never saw it coming.',
        '[dryly] That driver will be reviewing the mirrors tonight.',
        'One place gained. Do keep going.'] }]],
  ['overtaken_player', 2, 6, [{
    e: ['Oh, passed! The door was left wide open there.',
        'Lost a place! Too cautious into that corner.',
        'They come through on the inside. Must respond now!',
        'Overtaken! Come on, fight back!',
        'A place gone. Head down, there is still time.'],
    a: ['[sighs] Mugged at the apex. Tragic, and entirely avoidable.',
        'The door was open, and someone walked straight through it.',
        'A position surrendered rather too politely, I thought.',
        'Overtaken. One hopes this is a temporary arrangement.',
        'A lesson in defending, delivered by the other driver.'] }]],
  ['lead_taken', 3, 10, [{
    e: ['[shouting] Into the lead! P1! Bellissimo!',
        'Front of the field! Nobody ahead now!',
        'The lead is taken! Now, can they keep it?',
        'Leading the race! Clear air at last!'],
    a: ['In the lead. Now comes the difficult part.',
        'P1. Clear air, and nobody to blame but oneself.',
        'The lead, taken with genuine authority.',
        '[dryly] Leading. I may have to revise my predictions.'] }]],
  ['lead_lost', 3, 10, [{
    e: ['No! The lead is gone!',
        'Passed for first place! Mamma mia, so close.',
        "Lost P1! Stay in the slipstream, it's not finished!",
        'Second now. The fight is still on!'],
    a: ['And the lead slips away. Momentarily, one hopes.',
        'Leadership is a lease, not a freehold.',
        'P1 surrendered. That will sting for a while.',
        'Demoted. Now we learn something about their character.'] }]],
  ['defending', 2, 12, [{
    e: ['Defending well! Covering the inside line.',
        'Holding them off! Mirrors, mirrors, mirrors!',
        'Under pressure, but not giving an inch!',
        'They want the place, but the door is shut.'],
    a: ['Firm defending. Within the rules, just about.',
        'The inside is covered. Clever positioning.',
        'One move only, mind. We are not barbarians.',
        'Calm under pressure. I am almost impressed.'] }]],
  ['side_by_side', 2, 10, [{
    e: ['[excited] Side by side! Nobody is lifting!',
        'Wheel to wheel into the corner! Who blinks?',
        'Door to door! This is racing, my friends!',
        'Together through the turn! Incredible!'],
    a: ['Side by side. One of them will have to be sensible.',
        'Wheel to wheel. My heart rate disapproves.',
        'Neither yielding. Admirable, and slightly mad.',
        "Inches apart. Somebody's insurer is watching through their fingers."] }]],
  ['slipstream', 2, 15, [{
    e: ['In the slipstream now, getting the tow!',
        'Tucked in behind, pulled along. Get ready!',
        'Using the draft! Pull out at the right moment!',
        'Right under the rear wing. Patience...'],
    a: ['The tow. Physics, kindly lending a hand.',
        'Sheltering in the wake. A move is being planned.',
        'Free speed from the car ahead. It would be rude not to.',
        'Close enough to read their tyre pressures.'] }]],
  ['nitro_used', 2, 10, [{
    e: ['[excited] Nitro! Look at it fly!',
        'Boost engaged! Andiamo, andiamo!',
        'Hit the nitro! Like a missile down the straight!',
        'There goes the nitro. Timing, perfect!'],
    a: ['Nitrous. Subtlety departs with a very loud bang.',
        'Boost deployed. On a straight, at least. Good.',
        '[dryly] The engine will be filing a formal complaint.',
        "Nitro used. Let's hope the brakes were informed."] }]],
  ['fastest_lap', 2, 20, [{
    e: ['Fastest lap of the race! Nobody has gone quicker!',
        "That's the fastest lap! The car is singing!",
        'Quickest of anyone tonight! Bellissimo!',
        'Fastest lap! Pushing to the very edge!'],
    a: ['The fastest lap of the race. Rather splendid.',
        'Quickest lap of anyone. The stopwatch approves.',
        'Fastest lap. I shall allow myself a small nod.',
        'A lap of real precision. Fastest of the night.'] }]],
  ['personal_best', 1, 30, [{
    e: ['A personal best! Getting faster every lap!',
        'New best lap! The rhythm is coming now!',
        'Personal best! The confidence is growing, I can see it.'],
    a: ['A personal best. Improvement, at last measurable.',
        'Their quickest lap yet. Progress, of a sort.',
        'Personal best. The braking points are being found.'] }]],
  ['lap_one_complete', 1, 0, [{
    e: ['First lap done! Everybody still in one piece?',
        'Lap one complete. Now the race starts to settle.',
        'One lap gone. The positions are taking shape.'],
    a: ['Lap one survived. Statistically, the hardest one.',
        'One lap down. The nervous part is over.',
        'The opening lap complete. Now the strategy begins.'] }]],
  ['halfway', 1, 0, [{
    e: ['Halfway! Plenty still to happen tonight.',
        'We are at half distance. Time to push.',
        'Half the race gone. Who has saved something?'],
    a: ['Half distance. The tyres are no longer young.',
        'Halfway. The race begins to show its true shape.',
        'Fifty per cent complete. My optimism, considerably less.'] }]],
  ['final_lap', 3, 0, [{
    e: ['[shouting] Final lap! Everything on the line!',
        'Last lap! No more saving, all or nothing!',
        'Final lap, my friends! Give it everything!',
        'One more lap! The finish is calling!'],
    a: ['The final lap. Nerve, not horsepower, decides it now.',
        'Last lap. Please, nobody do anything silly.',
        'Final lap. Every mistake from here is permanent.',
        'The last lap. This is where legends and fools are made.'] }]],
  ['last_corner_battle', 3, 0, [{
    e: ['[shouting] Last corner! Side by side for the line!',
        'Final turn, and they are together! Who wants it more?',
        'Into the last corner, still fighting! Incredible!'],
    a: ["The final corner. Somebody's about to be very brave.",
        'Last bend, nose to tail. Exquisite tension.',
        'One corner left. Choose the line, and pray.'] }]],
  ['off_track', 2, 10, [{
    e: ['Off the track! Into the run-off!',
        'Wide! Onto the dirt, losing time!',
        'Ran out of road there! Get back on!',
        'Too much speed, and straight on!'],
    a: ['[dryly] The track, for reference, is the grey bit.',
        'Off. An unscheduled excursion.',
        'Exploring the scenery. Not what we came for.',
        'Ran wide. Optimism exceeded grip.'] }]],
  ['spin', 2, 10, [{
    e: ['[gasps] Spin! Around it goes!',
        'Lost the rear! Spinning!',
        'Mamma mia, a full spin! Keep it off the wall!',
        'Round and round! Get it pointed the right way!'],
    a: ['A pirouette. The judges are unimpressed.',
        'Spun. Too much throttle, too little patience.',
        'Facing the wrong way. Always disorienting.',
        '[sighs] And the rear overtakes the front.'] }]],
  ['soft_crash', 2, 8, [{
    e: ['Contact! A little bump there.',
        'Ooh, touched the barrier! Some damage?',
        'A tap on the wall. Should be okay.',
        'Bumping cars! Not too serious, I think.'],
    a: ['A gentle kiss of the barrier. Paintwork only.',
        'Contact. Minor, but entirely unnecessary.',
        'A nudge. The bodyshop will send a card.',
        "Bumped. Nothing broken except one's pride."] }]],
  ['hard_crash', 3, 5, [{
    e: ['[shouting] Huge crash! Into the wall!',
        'Mamma mia! A massive impact there!',
        'Big hit! Glass everywhere!',
        'Oh no, a heavy crash! That car is wrecked!'],
    a: ["[gasps] Oh, that's a big one. Very big.",
        'A heavy impact. That will need more than tape.',
        'Destroyed. The barrier won that argument decisively.',
        'Expensive. Spectacularly, eye-wateringly expensive.'] }]],
  ['wall_scrape', 2, 10, [{
    e: ['Scraping the wall! Sparks flying!',
        'Kissing the barrier all the way along there!',
        'Too close to the wall, grinding along!'],
    a: ['Grinding the barrier. The sound of money leaving.',
        'Brushed the wall. Close is good. That was closer.',
        'Sparks. Pretty, but deeply inadvisable.'] }]],
  ['recovery_after_incident', 2, 15, [{
    e: ['Back on track! Now chase them down!',
        'Going again! Never give up, never!',
        'Rejoined the race. Focus now, forget it.',
        'Recovering well. The fight continues!'],
    a: ['Back in the race. Composure regained, more or less.',
        "Rejoining. A little humbler, I'd hope.",
        'Under way again. Lessons, one trusts, absorbed.',
        'Recovered. Now, the long walk back up the order.'] }]],
  ['rain_starting', 2, 120, [{
    e: ['Rain is starting! Watch the grip now!',
        "Drops on the visor! It's beginning to rain!",
        'Here comes the rain! Mamma mia, everything changes!'],
    a: ['Rain. And the order may be about to shuffle.',
        'A shower arriving. The smooth will prosper.',
        'Raindrops. My favourite variable, and my least.'] }]],
  ['track_drying', 2, 120, [{
    e: ['The track is drying! A dry line is appearing!',
        'The rain has stopped. The grip comes back!',
        'Drying out now. Time to push again!'],
    a: ['A dry line emerging. Find it, and follow it.',
        'The circuit is drying. Brave pace returns.',
        'Drying. Puddles still lurk off-line, mind.'] }]],
  ['pit_entry', 2, 0, [{ mode: 'endurance',
    e: ['Into the pits! The crew is ready!',
        'Boxing this lap! Let\'s see the stop!',
        'Pit entry now. Watch the speed limit!'],
    a: ['In for service. Fuel, tyres, and a moment of reflection.',
        'Pitting. The crew will now earn their wages.',
        'Pit lane entry. The strategy reveals itself.'] }]],
  ['pit_stop_fast', 2, 0, [{ mode: 'endurance',
    e: ['[excited] What a stop! Lightning fast!',
        'Bellissimo! The crew was perfect!',
        'Super quick in the pits! Places gained!'],
    a: ['A splendid stop. The mechanics deserve a raise.',
        'Choreographed beautifully. Not a wasted second.',
        'A fast stop. The strategy is vindicated.'] }]],
  ['pit_stop_slow', 2, 0, [{ mode: 'endurance',
    e: ['Slow stop! Something went wrong!',
        'Taking too long! Come on, come on!',
        'A delay in the pits! Precious seconds lost!'],
    a: ['[sighs] A sluggish stop. Somebody fumbled.',
        'Still stationary. I could have changed that tyre myself.',
        'A slow stop. That will be discussed. Loudly.'] }]],
  ['pit_exit', 2, 0, [{ mode: 'endurance',
    e: ['Out of the pits! Back into the fight!',
        'Rejoining now. Fresh tyres, full attack!',
        'Pit exit! Where do they come out?'],
    a: ['Out of the pit lane. Watch the traffic.',
        'Back on track, on cold tyres. Gently, please.',
        'Rejoined. Now we see if the stop has paid.'] }]],
  ['pit_limiter_warning', 2, 5, [{ mode: 'endurance',
    e: ['Careful! Speeding in the pit lane!',
        'Too fast in the pits! Limiter, limiter!',
        'Watch the pit speed! A penalty is coming!'],
    a: ['Pit lane speeding. The stewards adore that.',
        "The limiter, please. It's the button for exactly this.",
        "Too quick in the pit lane. That's a penalty."] }]],
  ['stint_change_dusk_to_night', 2, 0, [{ mode: 'endurance',
    e: ['The sun has gone. Now we race into the night!',
        'Dusk becomes night. Headlights on, a new race begins.',
        'The sky turns dark blue. Bellissimo, the night stint!'],
    a: ['Night falls. The track cools, and so, one hopes, do tempers.',
        'Into the dark. Braking markers become educated guesswork.',
        'The blue hour passes. Endurance racing at its most beautiful.'] }]],
  ['player_wins', 3, 0, [{
    e: ['[shouting] Winner! What a drive! Bellissimo!',
        "[excited] Across the line first! A champion's performance!",
        'Victory! Mamma mia, they did it!',
        'First place! Nobody could stop them tonight!'],
    a: ["The win. Genuinely deserved. I don't say that lightly.",
        'Victory, achieved with real style. Bravo.',
        'A win. Even I shall applaud. Briefly.',
        'First across the line. Faultless, or very nearly.'] }]],
  ['player_podium', 3, 0, [{
    e: ['A podium! A great result!',
        'Onto the podium! Champagne tonight!',
        'Top three! A very good drive!'],
    a: ['A podium. Respectable, and then some.',
        'Top three. Not the win, but a fine evening.',
        'A podium finish. The trophy cabinet grows.'] }]],
  ['player_midfield', 3, 0, [{
    e: ['A midfield finish. Experience gained, and next time, more.',
        'Not the result we wanted, but a solid race.',
        'Across the line in the pack. We go again!'],
    a: ['A midfield finish. Competent, if unremarkable.',
        'Neither glory nor disgrace. The respectable middle.',
        'Mid-pack. There is speed in there, waiting to be unlocked.'] }]],
  ['player_last', 3, 0, [{
    e: ['Last place. A tough night, but we learn.',
        'At the back. Never mind, tomorrow is another race.',
        'Last across the line. Head up, my friend.'],
    a: ['[dryly] Last. But they did finish, which is something.',
        'Bringing up the rear. Somebody must.',
        'Last place. A character-building evening.'] }]],
  ['photo_finish', 3, 0, [{
    e: ['[shouting] Photo finish! Who got it?',
        'Together on the line! Too close to call!',
        "Mamma mia, a photo finish! I can't separate them!"],
    a: ['A photo finish. The camera must arbitrate.',
        'Separated by a whisker, if that.',
        'A dead heat to the naked eye. Thrilling.'] }]],
  ['winner_fireworks', 3, 0, [{
    e: ['[excited] Fireworks! Look at the sky! What a celebration!',
        'The fireworks go up for the winner! Bellissimo!',
        'Listen to that! The whole circuit is celebrating!'],
    a: ['Fireworks. Loud, extravagant, and for once entirely appropriate.',
        'The sky lit up for the winner. Rather lovely, actually.',
        'Pyrotechnics. Usually a touch vulgar. Tonight, I shall allow it.'] }]],
  ['general_filler', 1, 25, [{
    e: ['When I raced, we braked by counting the lamp posts. Crazy days.',
        'You know, the bravest drivers are not the loudest. They are the calmest.',
        'My father ran a tyre shop. I learned to drive delivering tyres, much too fast.',
        'Allora, late braking is an art. Too early, you lose. Too late, you crash.',
        'Night races change the drivers. Everybody becomes a little bit of a poet.',
        'I love the sound of these engines echoing off the walls.',
        'In my junior days: one mechanic, one van, and a lot of espresso.',
        'Racing is simple, my friends. Go fast, turn left, turn right, repeat.',
        'Every corner here is asking a question. The good drivers answer it.',
        'The best overtakes are planned two corners before. Always.',
        'Sometimes I miss the cockpit. Then I remember the bruises.',
        'Mamma mia, the atmosphere tonight. You can feel it in your chest.',
        'Smooth hands, fast car. My first coach told me that every single day.',
        'Tyres are like coffee. Too cold, terrible. Too hot, also terrible.'],
    a: ['The early night races were lit by lamps, I am told. Visibility was largely theoretical.',
        'A racing car is ten thousand compromises, holding hands.',
        'I once spent a whole night calculating fuel loads. The driver ignored every one.',
        'Grip is a finite resource. Spend it like a miser.',
        'The finest drivers make it look slow. That is the whole trick.',
        'The clocks in my cottage keep better time than most pit crews.',
        'Patience is the cheapest upgrade in motorsport.',
        'I have seen more laps lost to impatience than to engines.',
        'The camber here is doing a great deal of quiet work.',
        'Every barrier on this circuit has a story. Few of them happy.',
        'Brakes, not bravery, win races. Bravery merely ends them.',
        'Chapter nine of my book is entirely about kerbs. Riveting stuff.',
        'In the dark, sound tells you more than sight. Listen to the engine.',
        '[sighs] I do miss the smell of a pit lane at three in the morning.'] }]],
  ['booth_exchanges', 1, 45, [
    { d: [[E, 'Alastair, would you ever get back in a race car?'], [A, 'I would sooner juggle the fire extinguishers, Enzo.']] },
    { d: [[A, 'That was a remarkably clumsy piece of driving.'], [E, '[laughs] You say that about everything!'], [A, 'Because it is usually true.']] },
    { d: [[E, "Bellissimo! That's what I call racing!"], [A, 'You would call a car park queue racing if it had headlights.']] },
    { d: [[A, 'Did you brake that late in your day, Enzo?'], [E, 'Later! Much later!'], [A, 'Hence the wrist.']] },
    { d: [[E, 'Tell me, how many clocks do you own now?'], [A, 'Forty-one. Every one of them more punctual than you.']] },
    { d: [[A, 'Night racing was invented to hide poor driving.'], [E, 'No, no, no! It was invented to make it beautiful!']] },
    { d: [[E, 'Alastair, you are smiling. I saw it!'], [A, '[dryly] Indigestion, Enzo. Nothing more.']] },
    { d: [[A, 'Those tyres must be screaming by now.'], [E, 'Like me in this booth. We understand each other.']] },
    { d: [[E, 'In Italy we say the brave ones go first.'], [A, 'In Britain we say the brave ones go first into the barrier.']] },
    { d: [[E, 'Rain or dry, Alastair? Which do you prefer?'], [A, 'Dry. Rain makes you shout, and I have only the one pair of ears.']] },
    { d: [[A, 'I brought sandwiches. Cucumber.'], [E, 'Cucumber again? Mamma mia, next time I bring real food.']] },
    { d: [[E, 'You know, you are my favourite grumpy Englishman.'], [A, 'I am your only grumpy Englishman. The competition is thin.']] },
  ]],
  // Kavya: the user kept her to these 5 recorded lines (2026-10-19). subject = team id or driver code from assets/teams/teams.json.
  ['paddock_report', 1, 120, [
    { when: 'pre_race', k: [
      '[warmly] Hello from the paddock! Kavya Iyer here, with twelve drivers, six teams, and far too many secrets for one notebook.'] },
    { subject: 'saetta', k: ["Saetta's garage smells of espresso and hot brakes. Vittoria Saldani runs it like an opera house. [laughs] Lots of shouting, and somehow it always ends beautifully."] },
    { subject: 'VAR', k: ['Matteo Varrone kisses the lightning bolt on his helmet before every start. [chuckles] Then he brakes about ten metres later than physics recommends.'] },
    { subject: 'LIN', k: ['Freya Lindqvist learned car control on the frozen lakes of Sweden. She told me grip is overrated. [laughs] She meant it.'] },
    { subject: 'QAS', k: ["Layla Qasimi learned to race on the desert roads of Oman, in her uncle's pickup truck. [laughs] Now she holds the record for passes in a single race."] },
  ]],
];

// Categories whose lines must land mid-race (3-14 words); the rest may run to ~45.
const LONG = new Set(['intro_session', 'intro_track', 'booth_backstory', 'general_filler', 'booth_exchanges', 'paddock_report']);
const words = (t) => t.replace(/\[[^\]]+\]/g, '').trim().split(/\s+/).filter(Boolean).length;

const lines = [];
const counters = {};
const nextId = (sp, cat) => {
  const k = sp + '.' + cat;
  counters[k] = (counters[k] || 0) + 1;
  return `${k}.${String(counters[k]).padStart(2, '0')}`;
};
const push = (cat, p, cd, g, sp, text) => {
  const id = nextId(sp, cat);
  if (sp === E) { text = ENZO[id]; if (!text) throw new Error('no v2 text for ' + id); }
  const line = { id, category: cat, speaker: sp, text, priority: p, cooldown_s: cd };
  if (g.when) line.when = g.when;
  if (g.mode) line.mode = g.mode;
  if (g.subject) line.subject = g.subject;
  const n = words(text);
  if (LONG.has(cat) ? n > 45 : n < 3 || n > 14) throw new Error(`length ${n}: ${line.id} "${text}"`);
  lines.push(line);
  return line;
};
for (const [cat, p, cd, groups] of data) {
  for (const g of groups) {
    if (g.d) {
      let prev = null;
      for (const [sp, text] of g.d) {
        const l = push(cat, p, cd, g, sp, text);
        if (prev) prev.pair = l.id;
        prev = l;
      }
    } else {
      // interleave so ids and the .md read in order per speaker
      for (const t of g.e || []) push(cat, p, cd, g, E, t);
      for (const t of g.a || []) push(cat, p, cd, g, A, t);
      for (const t of g.k || []) push(cat, p, cd, g, K, t);
    }
  }
}

// self-check: unique ids, pairs resolve, totals in range, every v2 Enzo line used, Kavya subjects real
const ids = new Set(lines.map((l) => l.id));
if (ids.size !== lines.length) throw new Error('duplicate ids');
for (const l of lines) if (l.pair && !ids.has(l.pair)) throw new Error('bad pair ' + l.id);
const count = (sp) => lines.filter((l) => l.speaker === sp).length;
for (const sp of [E, A]) if (count(sp) < 160 || count(sp) > 220) throw new Error(`${sp} has ${count(sp)} lines`);
if (count(K) > 20) throw new Error(`kavya has ${count(K)} lines (max 20)`);
for (const id of Object.keys(ENZO)) if (!ids.has(id)) throw new Error('unused v2 line ' + id);
const teams = JSON.parse(fs.readFileSync('D:/RaceUltimate/assets/teams/teams.json', 'utf8')).teams;
const subjects = new Set(teams.flatMap((t) => [t.id, ...t.cars.map((c) => c.driver.code)]));
for (const l of lines) if (l.subject && !subjects.has(l.subject)) throw new Error('unknown subject ' + l.id);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'script.json'), JSON.stringify({ version: 1, speakers, lines }, null, 2) + '\n');

// ---- SCRIPT.md
const md = [];
md.push('# Ultrack booth script', '');
md.push('Original commentary for Ultrack, written for ElevenLabs eleven_v4 voices. Bracketed words such as `[excited]` or `[laughs]` are audio tags, not spoken text. The machine-readable copy is `script.json`; this file is the same lines grouped for reading. Generated by `tools/audio/gen_announcer_script.js` (Enzo\'s lines live in `tools/audio/enzo_lines.js`); teams and drivers are in `assets/teams/TEAMS.md`.', '');
md.push(`Lines: Enzo ${count(E)}, Alastair ${count(A)}, Kavya ${count(K)}, total ${lines.length}.`, '');
md.push('## The booth', '');
for (const s of Object.values(speakers)) md.push(`### ${s.name}`, '', s.bio, '', `*Voice:* ${s.voice_notes}`, '');
md.push('## How the game picks lines', '');
md.push(
  '- **Event to category.** Each game event maps to the category of the same name (an overtake by the player fires `overtake_player`, a lap with the session\'s best time fires `fastest_lap`, and so on). Some lines carry a `when` filter: `intro_session` by mode (`free`, `race`, `endurance`) and by light/weather (`dusk`, `night`, `rain`), `intro_track` by circuit (`corniche`, `sahyadri`), `grid_and_lights` by phase (`formation`, `lights_on`, `lights_out`). Lines with `mode: "endurance"` (pit stops and the dusk-to-night stint change) only play in Endurance.',
  '- **Session opening.** Pre-race plays one mode intro, then one light/weather intro (rain wins over the time of day), then the circuit\'s `intro_track` pair. In a session\'s first race the game may add one `booth_backstory` exchange before the grid.',
  '- **Who speaks.** Enzo calls the play-by-play: event lines default to him. The voices alternate: the one that did not just talk goes next (Enzo opens), never three in a row from one voice unless only one has a line. After an Enzo event line Alastair answers from the same category about half the time, 0.4-0.8 s after Enzo ends; a `pair` chain replies the same way.',
  '- **Cooldowns.** `cooldown_s` is per category and speaker: once a line plays, that category stays silent for that speaker until the cooldown passes (0 = no cooldown, the event itself is rare). Between exchanges the booth stays quiet for 10 s after a priority-1 line, 6 s after priority 2, 1.5 s after priority 3; the last minute is capped at 35% airtime (priority 3 ignores the cap), so music has room. Only a priority-3 line cuts one off.',
  '- **No repeats.** Each speaker keeps a shuffled bag per category (and `when`). A line is not heard again until every line in its bag has played; on reshuffle, the last line played cannot come first.',
  '- **Two-handers.** A line with `pair` is answered at once by the line it names (which may itself have a `pair`, for three-line exchanges). The chain plays as one unit; it starts only from the beginning, and only a priority-3 event can cut it.',
  '- **Priority.** 3 = defining moments (lights out, start, lead change, big crash, final lap, last corner, results, fireworks); 2 = race events; 1 = colour (fillers, exchanges, backstory, lap milestones, personal bests). A higher-priority line cuts a lower one off (fade the cut line over 150 ms); equal priority queues for up to 2 s, then drops. Fillers and exchanges only start after 8 s with no event line, never in the last corner or on the final lap.',
  '- **Results.** At the line, play `photo_finish` if the gap is under 0.05 s, then exactly one of `player_wins`, `player_podium`, `player_midfield` or `player_last`; `winner_fireworks` plays as the fireworks go up.',
  '- **Names.** Event lines are about the player\'s car, so Enzo names a team or driver there only as colour or comparison ("Very Varrone!"), never as the one doing the move. Intros, fillers and exchanges name them freely. Alastair\'s lines name nobody.',
  '- **Paddock reports.** Kavya speaks only `paddock_report` (colour, priority 1, cooldown 120 s). In a session\'s first race one `pre_race` line may follow the circuit intro. In a race, a paddock report may take a filler slot (about one in four); prefer a line whose `subject` (team id or driver code) is on the grid, and never two in a row.',
  '',
);
const label = (l) => (l.pair ? ` → *${l.pair}*` : '');
const byCat = new Map();
for (const l of lines) {
  if (!byCat.has(l.category)) byCat.set(l.category, []);
  byCat.get(l.category).push(l);
}
md.push('## Lines', '');
for (const [cat, ls] of byCat) {
  const f = ls[0];
  md.push(`### ${cat}`, '', `Priority ${f.priority} · cooldown ${f.cooldown_s} s${f.mode ? ' · Endurance only' : ''}`, '');
  const dialogue = ls.some((l) => l.pair);
  let lastWhen;
  for (const l of ls) {
    if (l.when !== lastWhen) { md.push('', `**${l.when}**`, ''); lastWhen = l.when; }
    const who = speakers[l.speaker].name.split(' ')[0];
    if (dialogue) {
      const starts = !lines.some((o) => o.pair === l.id);
      if (starts && l !== ls[0]) md.push('');
      md.push(`- **${who}:** ${l.text} \`${l.id}\`${label(l)}`);
    } else md.push(`- **${who}:** ${l.text} \`${l.id}\``);
  }
  md.push('');
}
fs.writeFileSync(path.join(OUT, 'SCRIPT.md'), md.join('\n').replace(/\n{3,}/g, '\n\n'));
console.log('enzo', count(E), 'alastair', count(A), 'total', lines.length);
