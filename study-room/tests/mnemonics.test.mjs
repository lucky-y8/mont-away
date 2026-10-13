import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { automaticMnemonic, mnemonicText } from '../src/mnemonics.js';

test('custom cues override automatic hints and clearing returns to current answer', () => {
  const q = { type: 'fill', stem: '组成包括________和________。', options: [], answer: '甲；乙' };
  assert.match(mnemonicText(q), /甲 → 乙/);
  assert.equal(mnemonicText({ ...q, mnemonic: '  我的口诀  ' }), '我的口诀');
  const revised = { ...q, answer: '丙；丁', mnemonic: '' };
  assert.match(mnemonicText(revised), /丙 → 丁/);
  assert.doesNotMatch(mnemonicText(revised), /甲/);
});

test('choice cues use option meanings, keep negative wording and avoid guessing unknown answers', () => {
  const q = { type: 'single', stem: '错误的是哪项？', options: ['甲概念', '乙概念'], answer: 'B' };
  assert.match(automaticMnemonic(q), /否定词/);
  assert.match(automaticMnemonic(q), /乙概念/);
  assert.doesNotMatch(automaticMnemonic(q), /记忆锚点：B/);
  assert.match(automaticMnemonic({ ...q, answer: '' }), /补充参考答案/);
  assert.match(automaticMnemonic({ ...q, stem: '网络协议的要素不包括' }), /语法管格式/);
});

test('every bundled question gets a bounded, nonempty cue without mutating source data', () => {
  const questions = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(questions);
  for (const q of questions) {
    const cue = mnemonicText(q);
    assert.ok(cue.length > 15 && cue.length < 800, q.id);
    assert.doesNotMatch(cue, /undefined|\[object Object\]/, q.id);
  }
  assert.equal(JSON.stringify(questions), before);
});

test('asymmetric cryptography does not receive the symmetric-key cue', () => {
  const cue = automaticMnemonic({type:'short',stem:'简述非对称加密的特点。',options:[],answer:'采用公钥和私钥。'});
  assert.match(cue, /公私成对/);
  assert.doesNotMatch(cue, /同一把钥匙/);
});

test('differential Manchester cue focuses on the start of each symbol', () => {
  const cue = automaticMnemonic({type:'short',stem:'简述差分双相码（差分曼彻斯特码）的规则。',options:[],answer:'每个码元中间跳变，起点跳变表示数据。'});
  assert.match(cue, /起点跳变管数据/);
});
