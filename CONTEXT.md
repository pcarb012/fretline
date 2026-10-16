# Fretline

A browser guitar trainer: it listens to the player through the microphone, scrolls a song's notes toward a hit line and grades each one.

## Language

### Songs

**Song**:
A playable piece: a tempo, a tuning and a list of notes, optionally divided into sections.
_Avoid_: Track, chart, level

**Tempo**:
A song's own pace, in beats per minute. Fixed per song; the player never changes it.
_Avoid_: Speed (for BPM), pace

**Section**:
A named stretch of a song, starting at a given beat and running until the next section starts.
_Avoid_: Part, segment, phrase

**Lesson**:
A song in the ordered course. A lesson is locked until the one before it has earned a star in a run; a locked lesson can still be practised.
_Avoid_: Level, stage

### Playing

**Speed**:
How fast the player plays a song, as a fraction of its tempo (0.75 is three-quarters of the tempo).
_Avoid_: Tempo (for the fraction), rate, playback rate

**Run**:
One full play-through of a song, from the first note to the last, ending on a results screen. Only runs count toward bests, stars and unlocks.
_Avoid_: Play, attempt, game

**Practice**:
The mode in which the player repeats a loop instead of playing a run. Practice never counts toward bests, stars or unlocks.
_Avoid_: Drill, loop mode, training

**Loop**:
The one or more consecutive sections the player is practising. A song without sections is a single-section loop.
_Avoid_: Range, selection, region

**Pass**:
One play-through of the loop during practice.
_Avoid_: Lap, repetition, iteration

**Break**:
The three-beat count-in between two passes, during which nothing is scored and any backing track is silent.
_Avoid_: Gap, pause, rest

**Hit rate**:
The share of scored notes and chords in a pass that were hit, whether Perfect or Good.
_Avoid_: Accuracy, score (score also weighs timing)

**Good pass**:
A pass with a hit rate of at least 90%. Two good passes in a row raise the speed by one step.
_Avoid_: Clean pass, successful pass

**Full speed**:
A speed of 1, the song's own tempo. Practice never goes above it.
_Avoid_: 100%, normal speed
