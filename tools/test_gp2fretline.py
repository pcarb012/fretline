"""Self-check for gp2fretline. Run:
    uv --directory C:/Users/peter/projects/guitar-pro-mcp run python -m unittest discover -s <repo>/tools
"""
import os
import sys
import unittest

import guitarpro as gp

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gp2fretline as conv  # noqa: E402

STANDARD = [64, 59, 55, 50, 45, 40]


def make_song(bars, shuffle=False):
    """bars: one list per bar of (value, tuplet, [(string, fret, kind)]); kind: n/d/g/t."""
    song = gp.Song()
    song.tracks = []
    song.measureHeaders = []
    track = gp.Track(song, number=1, name="Guitar")
    track.strings = [gp.GuitarString(i + 1, v) for i, v in enumerate(STANDARD)]
    start = gp.Duration.quarterTime
    for n, bar in enumerate(bars, 1):
        header = gp.MeasureHeader(number=n, start=start)
        header.tripletFeel = gp.TripletFeel.eighth if shuffle else gp.TripletFeel.none
        if n == 1:
            header.marker = gp.Marker(title="Intro")
        song.measureHeaders.append(header)
        measure = gp.Measure(track, header)
        voice = measure.voices[0]
        pos = start
        for value, tuplet, notes in bar:
            beat = gp.Beat(voice, start=pos)
            beat.duration = gp.Duration(value=value)
            if tuplet:
                beat.duration.tuplet = gp.Tuplet(enters=3, times=2)
            beat.status = gp.BeatStatus.normal if notes else gp.BeatStatus.rest
            for string, fret, kind in notes:
                note = gp.Note(beat, string=string, value=fret)
                note.type = {"d": gp.NoteType.dead, "t": gp.NoteType.tie}.get(kind, gp.NoteType.normal)
                note.effect.ghostNote = kind == "g"
                beat.notes.append(note)
            voice.beats.append(beat)
            pos += beat.duration.time
        track.measures.append(measure)
        start += header.length
    song.tracks.append(track)
    return song


class ConvertTest(unittest.TestCase):
    def test_straight_eighths_and_rest(self):
        bar = [(8, False, [(6, 0, "n")]), (8, False, []), (4, False, [(5, 2, "n")]), (2, False, [])]
        out = conv.convert(make_song([bar]), "x", "X")
        self.assertEqual([(n["beat"], n["durationBeats"]) for n in out["notes"]], [(0, 0.5), (1, 1)])
        self.assertEqual(out["tuning"], [40, 45, 50, 55, 59, 64])
        self.assertEqual(out["sections"], [{"beat": 0, "name": "Intro"}])

    def test_shuffle_moves_offbeat_eighth(self):
        bar = [(8, False, [(6, 0, "n")]), (8, False, [(6, 3, "n")])] * 2 + [(2, False, [])]
        notes = conv.convert(make_song([bar], shuffle=True), "x", "X")["notes"]
        self.assertEqual([n["beat"] for n in notes], [0, 0.6667, 1, 1.6667])
        self.assertEqual(notes[0]["durationBeats"], 0.6667)
        self.assertEqual(notes[1]["durationBeats"], 0.3333)

    def test_triplets_keep_their_spacing(self):
        bar = [(8, True, [(6, 0, "n")])] * 3 + [(2, False, []), (4, False, [])]
        notes = conv.convert(make_song([bar], shuffle=True), "x", "X")["notes"]
        self.assertEqual([n["beat"] for n in notes], [0, 0.3333, 0.6667])

    def test_tie_extends_previous_note(self):
        bar = [(4, False, [(6, 5, "n")])] * 1 + [(2, False, []), (4, False, [])]
        bar2 = [(4, False, [(6, 5, "t")]), (2, False, []), (4, False, [])]
        notes = conv.convert(make_song([bar, bar2]), "x", "X")["notes"]
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]["durationBeats"], 5)

    def test_muted_and_chord_notes_are_unjudged(self):
        bar = [(4, False, [(6, 0, "d")]), (4, False, [(5, 0, "g")]),
               (4, False, [(6, 3, "n"), (4, 2, "n")]), (4, False, [])]
        notes = conv.convert(make_song([bar]), "x", "X")["notes"]
        self.assertEqual([n.get("judge", True) for n in notes], [False, False, False, True])
        # highest pitch (string 4 fret 2 = 52) beats string 6 fret 3 (43)
        self.assertEqual(notes[3]["string"], 4)


if __name__ == "__main__":
    unittest.main()
