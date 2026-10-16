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
