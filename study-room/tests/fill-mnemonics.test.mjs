import test from 'node:test';
import assert from 'node:assert/strict';
import bank from '../data/questions.json' with { type: 'json' };
import { mnemonicDetails, mnemonicText } from '../src/mnemonics.js';

const fills = bank.filter(q => q.materialId === 'blanks');

test('all 509 fill summaries include bounded, question-specific memory aids', () => {
  assert.equal(fills.length, 509);
  assert.equal(bank.filter(q => Object.hasOwn(q, 'mnemonic')).length, fills.length);
  for (const q of fills) {
    assert.equal(q.type, 'fill');
    assert.equal(typeof q.mnemonic, 'string', q.id);
    assert.ok(q.mnemonic.length > 0 && q.mnemonic.length <= 4000, q.id);
    assert.equal(q.mnemonic.trim(), q.mnemonic, q.id);
    assert.match(q.mnemonic, /^题干线索：/u, q.id);
    assert.match(q.mnemonic, /\n\n联想记忆：/u, q.id);
  }
});

test('fill memory aids render intact, support overrides and clearing, and never mutate questions', () => {
  const before = JSON.stringify(fills);
  for (const q of fills) {
    const details = mnemonicDetails(q);
    assert.equal(details.custom, true, q.id);
    assert.equal(details.cards[0].meaning, q.mnemonic, q.id);
    assert.equal(details.reference, null, q.id);
    assert.equal(mnemonicText(q), q.mnemonic, q.id);
    assert.equal(mnemonicText({ ...q, mnemonic: '我的助记' }), '我的助记');
    assert.equal(mnemonicDetails({ ...q, mnemonic: '' }).custom, false, q.id);
  }
  assert.equal(JSON.stringify(fills), before);
});
