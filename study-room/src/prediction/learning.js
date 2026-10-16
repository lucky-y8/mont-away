const fields = ['type', 'stem', 'options', 'answer', 'explanation'];

// Compare the actual content, not a short hash; edits must never reuse stale teaching.
export function predictionLesson(q) {
  const item = q.learning?.id === q.id ? q.learning : null;
  if (!item || q.origin || !fields.every(key => JSON.stringify(q[key]) === JSON.stringify(item.baseline[key]))) return null;
  return item;
}

export function predictionMnemonic(q) {
  if (q.mnemonic?.trim()) return null;
  return predictionLesson(q);
}

export function hasLearningDraft(q) { return q.learning?.id === q.id; }

// A return-to-zero waveform follows the pulse width specified by the original figure.
export function wavePoints(levels, duty = 1, width = 36, start = 40, mid = 76, amplitude = 28) {
  const points = [[start, mid]];
  levels.forEach((level, i) => {
    const x = start + i * width, y = mid - level * amplitude;
    points.push([x, y], [x + width * duty, y]);
    if (duty < 1) points.push([x + width * duty, mid], [x + width, mid]);
  });
  return points.map(p => p.join(',')).join(' ');
}
