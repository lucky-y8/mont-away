// Only grade unambiguous reference answers. / 只自动判定结构明确的参考答案。
export function normalizeAnswer(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/gu, '').replace(/[。．，,；;！!？?]+$/u, '');
}

export function fillCount(question) {
  return Math.min((question.stem.match(/_{3,}/g) || []).length || 1, 20);
}

function aliases(answer) {
  const normalized = normalizeAnswer(answer);
  const results = new Set([normalized]);
  const alternative = normalized.match(/^(.*?)\((?:或(?:称|者|是)?|又称|也称|即)([^()]+)\)$/u);
  if (alternative && alternative[1]) {
    results.add(alternative[1]);
    results.add(alternative[2]);
  }
  const note = normalized.match(/^(.*?)\(按[^()]+\)$/u);
  if (note && note[1]) results.add(note[1]);
  return results;
}

function booleanAnswer(value) {
  const normalized = normalizeAnswer(value);
  if (['正确', '对', '是', 'true', 't', '√', '✓'].includes(normalized)) return 'true';
  if (['错误', '错', '否', 'false', 'f', '×', '✗', 'x'].includes(normalized)) return 'false';
  return null;
}

export function responseOptions(question) {
  if (question.type === 'truefalse' && !question.options.length) return ['正确', '错误'];
  return question.options;
}

export function expectedChoices(question) {
  const options = responseOptions(question);
  if (!['single', 'multiple', 'truefalse'].includes(question.type) || !options.length) return null;
  let answer = String(question.answer || '').normalize('NFKC').trim().toUpperCase();
  answer = answer.replace(/^(?:参考)?答案\s*[:：]\s*/, '').replace(/^[([{【]\s*|\s*[)\]}】]$/g, '');
  // Do not guess letters from explanatory prose. / 不从大段解析中猜测答案字母。
  if (/^[A-L](?:[\s,，、;；/]*[A-L])*$/.test(answer)) {
    const letters = [...new Set(answer.match(/[A-L]/g))].sort();
    if (letters.every(letter => letter.charCodeAt(0) - 65 < options.length) && (question.type === 'multiple' || letters.length === 1)) return letters;
  }
  if (question.type === 'truefalse') {
    const expected = booleanAnswer(question.answer);
    const matches = options.map((option, i) => booleanAnswer(option) === expected && expected ? String.fromCharCode(65 + i) : null).filter(Boolean);
    if (matches.length === 1) return matches;
  }
  const matches = options.map((option, i) => normalizeAnswer(option.replace(/^[A-L][.．、:：)）]\s*/, '')) === normalizeAnswer(question.answer) ? String.fromCharCode(65 + i) : null).filter(Boolean);
  return matches.length === 1 ? matches : null;
}

export function gradeResponse(question, choices = [], responses = []) {
  const review = { status: 'review', expectedOptions: [], blanks: [] };
  if (['single', 'multiple', 'truefalse'].includes(question.type)) {
    const expected = expectedChoices(question);
    if (!expected) return review;
    const actual = [...new Set(choices)].sort();
    return { status: actual.length && actual.join(',') === expected.join(',') ? 'correct' : 'incorrect', expectedOptions: expected, blanks: [] };
  }
  if (question.type === 'fill') {
    const expected = String(question.answer || '').split(/[；;]/).map(s => s.trim());
    const count = (question.stem.match(/_{3,}/g) || []).length;
    if (!count || count > 20 || expected.length !== count || expected.some(s => !s)) return review;
    const blanks = expected.map((answer, i) => ({ expected: answer, given: responses[i] || '', correct: !!normalizeAnswer(responses[i]) && aliases(answer).has(normalizeAnswer(responses[i])) }));
    return { status: blanks.every(blank => blank.correct) ? 'correct' : 'incorrect', expectedOptions: [], blanks };
  }
  return review;
}


// A correct subset is still in progress, not a wrong answer. / 多选题未选齐时不提前判错。
export function immediateChoiceResult(question, choices) {
  if (!choices.length) return null;
  const next = gradeResponse(question, choices);
  if (question.type === 'multiple' && next.status === 'incorrect' && choices.every(letter => next.expectedOptions.includes(letter))) return null;
  return next;
}
