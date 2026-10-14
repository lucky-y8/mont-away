import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mnemonicDetails, automaticMnemonic } from '../src/mnemonics.js';
import { mnemonicRules } from '../src/mnemonic-cues.js';

const question = (stem, answer, more = {}) => ({ type: 'short', options: [], stem, answer, ...more });

test('protocol offers an explained homophone and the correct printed/PDF page reference', () => {
  const d = mnemonicDetails(question('网络协议的三要素有哪些？', '语法、语义、时序'));
  const homophone = d.cards.find(c => c.kind === '谐音');
  assert.match(homophone.cue, /法医看表/);
  for (const word of ['语法', '语义', '时序']) assert.ok(homophone.meaning.includes(word));
  assert.deepEqual(d.reference.pages, [34, 35]);
  assert.deepEqual(d.reference.pdfPages, [41, 42]);
});

test('custom text stays intact and never acquires a fabricated textbook citation', () => {
  const text = '我的谐音\n第一句 → 第二句 <script>普通文字</script>';
  const d = mnemonicDetails(question('网络协议三要素', '语法、语义、时序', { mnemonic: `  ${text}  ` }));
  assert.equal(d.custom, true);
  assert.equal(d.cards.length, 1);
  assert.equal(d.cards[0].meaning, text);
  assert.equal(d.reference, null);
});

test('choice distractors never create subject matches; negative answers are not taught as true', () => {
  const q = question('以下哪项不属于网络协议三要素？', 'A', { type: 'single', options: ['编码', '时序', '语法', '语义'] });
  const d = mnemonicDetails(q);
  assert.equal(d.ruleId, 'protocol');
  assert.match(d.warning, /否定词/);
  assert.equal(d.cards.at(-1).cue, '编码');
  assert.match(d.cards.at(-1).meaning, /不要.*正确事实/);
  const unknown = mnemonicDetails(question('哪项属于本题定义？', 'B', { type: 'single', options: ['DNS', '乙概念'] }));
  assert.equal(unknown.reference, null);
  assert.equal(unknown.cards[0].cue, '乙概念');
  assert.match(automaticMnemonic({ ...q, answer: 'L' }), /补充参考答案/);
});

test('concept selection distinguishes similar encodings and exact fill answers', () => {
  assert.equal(mnemonicDetails(question('差分曼彻斯特的规则是什么？', '中间跳变')).ruleId, 'diff-manchester');
  assert.equal(mnemonicDetails(question('非对称加密的特点是什么？', '公钥与私钥')).ruleId, 'public-key');
  assert.equal(mnemonicDetails(question('用于数字签名的单向散列算法是？', 'MD5')).ruleId, 'hash');
  assert.equal(mnemonicDetails(question('将域名解析为 IP 地址的协议是___。', 'DNS', {type: 'fill'})).ruleId, 'dns');
  assert.equal(mnemonicDetails(question('IP 生存时间字段的作用是什么？', '限制跳数')).ruleId, 'ttl');
});

test('textbook watermark classification and calculation boundaries are explicit', () => {
  const watermark = automaticMnemonic(question('水印的检测方式主要分为哪两类？', '盲与非盲'));
  assert.match(watermark, /盲水印检测、非盲水印检测/);
  assert.doesNotMatch(watermark, /半盲/);
  assert.match(automaticMnemonic(question('CRC 怎么计算？', '补零求余')), /前导 0/);
  assert.match(automaticMnemonic(question('用香农公式计算信道容量', '结果')), /dB/);
  assert.match(automaticMnemonic(question('子网掩码怎么计算？', '结果')), /\/31、\/32/);
});

test('similar vocabulary does not confuse HTTP state, media access or OSI security', () => {
  assert.equal(mnemonicDetails(question('HTTP 克服无状态特性使用什么？', 'Cookie')).ruleId, 'http-cookie');
  assert.equal(mnemonicDetails(question('IEEE 802 的介质访问控制子层是什么？', 'MAC')).ruleId, 'link-sublayers');
  assert.equal(mnemonicDetails(question('基于 OSI 的安全体系结构有哪些安全机制？', '八类机制')).ruleId, 'security-mechanisms');
  assert.equal(mnemonicDetails(question('HTTP 非流水持久连接如何交互？', '复用连接逐个请求')).ruleId, 'http-connection');
});

test('updated answers and stems rebuild cues; image answers do not become invented formulas', () => {
  const q = question('组成包括___和___。', '甲；乙', {type: 'fill'});
  assert.match(mnemonicDetails(q).cards[0].cue, /甲 → 乙/);
  assert.match(mnemonicDetails({...q, answer: '丙；丁'}).cards[0].cue, /丙 → 丁/);
  const edited = mnemonicDetails({...q, id: 'ch01-q001', stem: '新的不相关知识点', answer: '新答案'});
  assert.equal(edited.reference, null);
  const image = mnemonicDetails(question('根据图求结果', '请对照下方资料原图中的答案；公式、上下标和表格以原图为准。', {type:'calculation'}));
  assert.equal(image.reference, null);
  assert.match(image.cards[0].note, /原图/);
  assert.doesNotMatch(image.cards[0].cue, /\d/);
});

test('the full bank has valid cards; citation ranges are bounded and source objects stay unchanged', () => {
  const bank = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(bank);
  for (const q of bank) {
    const d = mnemonicDetails(q);
    assert.ok(d.cards.length >= 1 && d.cards.length <= 4, q.id);
    assert.equal(new Set(d.cards.map(c => c.kind)).size, d.cards.length, q.id);
    for (const card of d.cards) {
      assert.ok(card.meaning.length > 10, q.id);
      assert.ok([card.cue, card.meaning, card.note].join('').length < 800, q.id);
      assert.doesNotMatch(JSON.stringify(card), /undefined|\[object Object\]/, q.id);
    }
    if (d.reference) {
      const [start, end] = d.reference.pages;
      assert.ok(start >= 33 && end >= start && end <= 440, q.id);
    }
  }
  assert.equal(JSON.stringify(bank), before);
  assert.equal(new Set(mnemonicRules.map(r => r.id)).size, mnemonicRules.length);
});
