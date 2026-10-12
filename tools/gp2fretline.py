"""Convert the Guitar track of a Guitar Pro file to Fretline song JSON.

    uv --directory C:/Users/peter/projects/guitar-pro-mcp run python \
        tools/gp2fretline.py "<file.gp5>" [--id 01] [--title "Name"] > out.json

Beats count quarter notes, so bpm is the file's tempo (quarter notes per minute),
also for 12/8. A shuffle feel (TripletFeel.eighth) moves each off-beat eighth to
two thirds of the beat. Ties extend the previous note, rests are skipped, dead and
ghost notes are kept with judge:false. When a beat has several notes the highest
pitch is judged and the rest are kept with judge:false.
Only voice 0, the first tempo and no capo are handled.
"""
from __future__ import annotations

import argparse
import json
import sys

import guitarpro as gp

QUARTER = gp.Duration.quarterTime  # ticks per quarter note
SHUFFLE_SPLIT = QUARTER // 2       # straight off-beat eighth
SHUFFLE_TO = QUARTER * 2 // 3      # shuffled off-beat eighth


def warp(tick: int) -> int:
    """Map a straight-eighth tick to its shuffled position within the quarter."""
    quarter, rest = divmod(tick, QUARTER)
    if rest <= SHUFFLE_SPLIT:
        rest = rest * SHUFFLE_TO // SHUFFLE_SPLIT
    else:
        rest = SHUFFLE_TO + (rest - SHUFFLE_SPLIT) * (QUARTER - SHUFFLE_TO) // (QUARTER - SHUFFLE_SPLIT)
    return quarter * QUARTER + rest


def span_ticks(beat: gp.Beat, origin: int, shuffle: bool) -> tuple[int, int]:
    """Start and end of a beat in ticks from the song start, shuffled if asked."""
    start = beat.start - origin
    end = start + beat.duration.time
    tuplet = beat.duration.tuplet.enters != 1
    if shuffle and not tuplet:
        return warp(start), warp(end)
    return start, end


def is_muted(note: gp.Note) -> bool:
    return note.type == gp.NoteType.dead or bool(note.effect.ghostNote)


def pitch(note: gp.Note, tuning: dict[int, int]) -> int:
    return tuning[note.string] + note.value


def beat_notes(notes: list[gp.Note], tuning: dict[int, int]) -> list[tuple[gp.Note, bool]]:
    """Each note with its judge flag: only the highest sounding pitch is judged."""
    sounding = [n for n in notes if not is_muted(n)]
    top = max(sounding, key=lambda n: pitch(n, tuning), default=None)
    return [(n, n is top) for n in notes]


def convert(song: gp.Song, song_id: str, title: str) -> dict:
    track = song.tracks[0]
    tuning = {s.number: s.value for s in track.strings}
    origin = song.measureHeaders[0].start
    notes: list[dict] = []
    sections: list[dict] = []
    open_by_string: dict[int, dict] = {}
    for measure in track.measures:
        header = measure.header
        shuffle = header.tripletFeel == gp.TripletFeel.eighth
        if header.marker:
            sections.append({"beat": round((header.start - origin) / QUARTER, 4),
                             "name": header.marker.title})
        for beat in measure.voices[0].beats:
            if beat.status != gp.BeatStatus.normal or not beat.notes:
                open_by_string.clear()
                continue
            start, end = span_ticks(beat, origin, shuffle)
            fresh = []
            for note in beat.notes:
                prev = open_by_string.get(note.string)
                if note.type == gp.NoteType.tie and prev:
                    prev["durationBeats"] = round(end / QUARTER - prev["beat"], 4)
                else:
                    fresh.append(note)  # an orphan tie becomes a note of its own
            for note, judged in beat_notes(fresh, tuning):
                entry = {"beat": round(start / QUARTER, 4), "string": note.string,
                         "fret": note.value, "durationBeats": round((end - start) / QUARTER, 4)}
                if not judged:
                    entry["judge"] = False
                notes.append(entry)
                open_by_string[note.string] = entry
    ordered = [tuning[n] for n in sorted(tuning, reverse=True)]
    return {"id": song_id, "title": title, "bpm": song.tempo, "tuning": ordered,
            "sections": sections, "notes": notes}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("file")
    parser.add_argument("--id", required=True)
    parser.add_argument("--title", required=True)
    args = parser.parse_args()
    song = gp.parse(args.file)
    json.dump(convert(song, args.id, args.title), sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
