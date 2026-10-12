const PX_PER_BEAT = 150;
const HIT_X_RATIO = 0.2;
const NOTE_H = 30;
const NOTE_R = 6;
const LABEL_LIFE_S = 0.9;
const LABEL_HOLD = 0.6;
const COLORS = {
  ink: '#1a1714', text: '#efe6d2', dim: '#9a8f7c', band: '#26221d',
  plate: '#e9dfc8', amber: '#ffb547', green: '#a6e36b', red: '#ff5a3c',
  steel: '#d8d4cc', bronze: '#c9a46a',
};
const LABEL_COLOR = { perfect: COLORS.green, good: COLORS.amber, miss: COLORS.red };
const GRADE_FILL = { perfect: COLORS.green, good: COLORS.amber, miss: COLORS.band };
const FONT = '"Bricolage Grotesque", "Segoe UI", sans-serif';
const MONO = '"Martian Mono", Consolas, monospace';

const laneY = (string, h) => (string - 0.5) * (h / 6);
// String 1 (high e) is thinnest; 4-6 are wound.
const gauge = (string) => 0.8 + (string - 1) * 0.55;

function drawStrings(g, w, h) {
  for (let s = 1; s <= 6; s++) {
    const y = laneY(s, h);
    const lw = gauge(s);
    g.lineWidth = lw;
    g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    g.beginPath();
    g.moveTo(0, y + lw + 1);
    g.lineTo(w, y + lw + 1);
    g.stroke();
    g.strokeStyle = s >= 4 ? COLORS.bronze : COLORS.steel;
    g.globalAlpha = 0.75;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
    g.globalAlpha = 1;
  }
}

function drawHitLine(g, h, hitX) {
  g.fillStyle = 'rgba(255, 181, 71, 0.06)';
  g.fillRect(hitX - 24, 0, 48, h);
  g.save();
  g.shadowColor = COLORS.amber;
  g.shadowBlur = 18;
  g.fillStyle = COLORS.amber;
  g.fillRect(hitX - 2, 0, 4, h);
  g.restore();
}

function plate(g, x, y, width) {
  g.beginPath();
  g.roundRect(x, y - NOTE_H / 2, width, NOTE_H, NOTE_R);
}

function fretText(g, note, x, y, width, color) {
  g.fillStyle = color;
  g.font = `700 17px ${FONT}`;
  g.textBaseline = 'middle';
  g.fillText(String(note.fret), Math.min(Math.max(x + 10, 6), x + width - 16), y + 1);
}

function drawUnjudged(g, note, x, y, width) {
  g.setLineDash([4, 4]);
  g.strokeStyle = COLORS.plate;
  g.lineWidth = 1.5;
  plate(g, x + 1, y, width - 2);
  g.stroke();
  g.setLineDash([]);
  fretText(g, note, x, y, width, COLORS.text);
}

function drawNote(g, note, x, y, width, result, inChord) {
  if (note.judge === false && !inChord) return drawUnjudged(g, note, x, y, width);
  const grade = result ? result.grade : null;
  g.save();
  if (grade === 'perfect' || grade === 'good') {
    g.shadowColor = GRADE_FILL[grade];
    g.shadowBlur = 16;
  } else {
    g.shadowColor = 'rgba(0, 0, 0, 0.6)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 2;
  }
  g.fillStyle = grade ? GRADE_FILL[grade] : COLORS.plate;
  plate(g, x, y, width);
  g.fill();
  g.restore();
  if (grade === 'miss') {
    g.strokeStyle = 'rgba(255, 90, 60, 0.5)';
    g.lineWidth = 1;
    plate(g, x + 0.5, y, width - 1);
    g.stroke();
  }
  fretText(g, note, x, y, width, grade === 'miss' ? COLORS.dim : COLORS.ink);
}

function drawNotes(g, w, h, hitX, frame) {
  const { song, beatSec, now, results } = frame;
  const scoredChord = new Set((frame.chords ?? []).filter((c) => c.scored >= 0).flatMap((c) => c.members));
  song.notes.forEach((note, i) => {
    const x = hitX + ((note.beat * beatSec - now) / beatSec) * PX_PER_BEAT;
    const width = Math.max(40, note.durationBeats * PX_PER_BEAT - 8);
    if (x + width < 0 || x > w) return;
    drawNote(g, note, x, laneY(note.string, h), width, results[i], scoredChord.has(i));
  });
}

/** A chord's name goes on the right end of its top plate, clear of the fret number. */
function drawChordNames(g, w, h, hitX, frame) {
  const { song, beatSec, now, results } = frame;
  g.font = `700 13px ${MONO}`;
  g.textBaseline = 'middle';
  g.textAlign = 'right';
  for (const chord of frame.chords ?? []) {
    if (!chord.name || chord.scored < 0) continue;
    const top = chord.members.reduce((a, b) => (song.notes[b].string < song.notes[a].string ? b : a));
    const note = song.notes[top];
    const x = hitX + ((note.beat * beatSec - now) / beatSec) * PX_PER_BEAT;
    const width = Math.max(40, note.durationBeats * PX_PER_BEAT - 8);
    if (width < 80 || x + width < 0 || x > w) continue;
    g.fillStyle = results[top]?.grade === 'miss' ? COLORS.dim : COLORS.ink;
    g.fillText(chord.name, x + width - 10, laneY(note.string, h) + 1);
  }
  g.textAlign = 'left';
}

function drawSections(g, w, hitX, frame) {
  const { song, beatSec, now } = frame;
  g.font = `500 11px ${MONO}`;
  g.textBaseline = 'top';
  g.fillStyle = COLORS.amber;
  for (const sec of song.sections ?? []) {
    const x = hitX + ((sec.beat * beatSec - now) / beatSec) * PX_PER_BEAT;
    if (x > w || x + g.measureText(sec.name).width < 0) continue;
    g.fillRect(x, 0, 2, 16);
    g.fillText(sec.name, x + 6, 3);
  }
}

function drawLabels(g, h, hitX, frame) {
  g.font = `700 20px ${FONT}`;
  g.textBaseline = 'middle';
  for (const l of frame.labels) {
    const age = frame.now - l.at;
    if (age < 0 || age > LABEL_LIFE_S) continue;
    const t = age / LABEL_LIFE_S;
    g.globalAlpha = t < LABEL_HOLD ? 1 : 1 - (t - LABEL_HOLD) / (1 - LABEL_HOLD);
    g.fillStyle = LABEL_COLOR[l.grade];
    g.fillText(l.label, hitX - 100, laneY(l.string, h) - NOTE_H - 4 - age * 24);
  }
  g.globalAlpha = 1;
}

/**
 * Draw one frame. frame = { song, beatSec, now, results, labels, chords }.
 * now is seconds from song beat 0 (negative during the count-in).
 */
export function drawHighway(canvas, frame) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const hitX = w * HIT_X_RATIO;
  drawStrings(g, w, h);
  drawHitLine(g, h, hitX);
  drawNotes(g, w, h, hitX, frame);
  drawSections(g, w, hitX, frame);
  drawChordNames(g, w, h, hitX, frame);
  drawLabels(g, h, hitX, frame);
}
