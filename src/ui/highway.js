const PX_PER_BEAT = 150;
const HIT_X_RATIO = 0.2;
const NOTE_H = 30;
const LABEL_LIFE_S = 0.9;
const COLORS = {
  bg: '#faf9f5', text: '#141413', rule: '#b0aea5', band: '#e8e6dc',
  orange: '#d97757', blue: '#6a9bcc', green: '#788c5d',
};
const GRADE_FILL = { perfect: COLORS.green, good: COLORS.orange, miss: COLORS.band };

const laneY = (string, h) => (string - 0.5) * (h / 6);

function drawLanes(g, w, h, hitX) {
  g.strokeStyle = COLORS.rule;
  g.lineWidth = 1;
  for (let s = 1; s <= 6; s++) {
    const y = Math.round(laneY(s, h)) + 0.5;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.strokeStyle = COLORS.orange;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(hitX, 0);
  g.lineTo(hitX, h);
  g.stroke();
}

function drawNote(g, note, x, y, width, result) {
  g.fillStyle = result ? GRADE_FILL[result.grade] : COLORS.blue;
  g.fillRect(x, y - NOTE_H / 2, width, NOTE_H);
  if (result && result.grade === 'miss') {
    g.strokeStyle = COLORS.rule;
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y - NOTE_H / 2 + 0.5, width - 1, NOTE_H - 1);
  }
  g.fillStyle = result && result.grade !== 'miss' ? COLORS.bg : COLORS.text;
  g.font = '600 18px Poppins, Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(String(note.fret), x + 10, y + 1);
}

function drawNotes(g, w, h, hitX, frame) {
  const { song, beatSec, now, results } = frame;
  song.notes.forEach((note, i) => {
    const x = hitX + ((note.beat * beatSec - now) / beatSec) * PX_PER_BEAT;
    const width = Math.max(40, note.durationBeats * PX_PER_BEAT - 8);
    if (x + width < 0 || x > w) return;
    drawNote(g, note, x, laneY(note.string, h), width, results[i]);
  });
}

function drawLabels(g, h, hitX, frame) {
  g.font = '600 20px Poppins, Arial, sans-serif';
  g.textBaseline = 'middle';
  for (const l of frame.labels) {
    const age = frame.now - l.at;
    if (age < 0 || age > LABEL_LIFE_S) continue;
    g.globalAlpha = 1 - age / LABEL_LIFE_S;
    g.fillStyle = l.grade === 'perfect' ? COLORS.green : l.grade === 'good' ? COLORS.orange : COLORS.text;
    g.fillText(l.label, hitX - 100, laneY(l.string, h) - NOTE_H - 4 - age * 24);
  }
  g.globalAlpha = 1;
}

/**
 * Draw one frame. frame = { song, beatSec, now, results, labels }.
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
  drawLanes(g, w, h, hitX);
  drawNotes(g, w, h, hitX, frame);
  drawLabels(g, h, hitX, frame);
}
