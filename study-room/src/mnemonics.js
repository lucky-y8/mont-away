import { expectedChoices, responseOptions } from './grading.js';
import { mnemonicRules } from './mnemonic-cues.js';

const choiceTypes = ['single', 'multiple', 'truefalse'];
// Only choice questions ask for an exception; calculation exclusions are conditions.
// 反选提示仅用于选择题；计算题的“不包括”通常是在限定计算范围。
const isNegative = q => ['single', 'multiple'].includes(q.type) && /不包括|不属于|不正确|错误的|不符合|不能|不具备|不采用|不是|不支持|不需要|不成立|不恰当|不合理/u.test(q.stem || '');
const isImageAnswer = answer => /请对照.*(?:原图|图片)|(?:答案|过程).*以原图为准/u.test(answer);
const clean = value => String(value || '').replace(/\s+/gu, ' ').trim();
const compact = (text, limit) => text.length <= limit ? text : text.slice(0, limit) + '…';

function answerWords(q) {
  if (choiceTypes.includes(q.type)) {
    const question = { ...q, options: q.options || [] };
    const letters = expectedChoices(question);
    if (letters) return letters.map(letter => responseOptions(question)[letter.charCodeAt(0) - 65].replace(/^[A-L][.．、:：)）]\s*/u, '')).join('；');
    // An unresolved letter is not a fact to memorize. / 无法解析的选项字母不能作概念。
    if (/^[A-L](?:[\s,，、;；/]*[A-L])*$/iu.test(clean(q.answer))) return '';
  }
  return String(q.answer || '').trim();
}

const exactAnswers = {
  '语法': 'protocol', '语义': 'protocol', '时序': 'protocol',
  '发送时延': 'delay', '传播时延': 'delay', '排队时延': 'delay',
  'dns': 'dns', '域名系统': 'dns', 'dhcp': 'dhcp', 'nat': 'nat', 'icmp': 'icmp', 'arp': 'arp',
  'smtp': 'email', 'pop3': 'email', 'imap': 'email', 'ftp': 'ftp', 'http': 'http', 'https': 'tls',
  'rip': 'routes', 'ospf': 'routes', 'bgp': 'routes', 'vlan': 'vlan', 'ppp': 'ppp',
  'csma/cd': 'csma-cd', 'csma/ca': 'csma-ca', '三次握手': 'tcp-handshake', '四次挥手': 'tcp-close',
  'crc': 'crc', '循环冗余校验': 'crc', '汉明距离': 'hamming', 'cmi': 'cmi', 'ami': 'ami',
  'pcm': 'pcm', '规程': 'physical-interface', '规程特性': 'physical-interface',
  'des': 'des', 'aes': 'aes', 'rsa': 'rsa', 'md5': 'hash', 'sha-1': 'hash', 'sha1': 'hash',
  '数字签名': 'signature', '数字证书': 'pki', 'pki': 'pki', 'pgp': 'pgp',
  '基于角色的访问控制': 'access', 'rbac': 'access', '物理隔离': 'physical-security',
};

function matchRule(q, answer) {
  const stem = String(q.stem || '');
  const matches = mnemonicRules.filter(rule => rule.pattern.test(stem));
  const exact = exactAnswers[clean(answer).normalize('NFKC').toLowerCase()];
  // An exact answer can disambiguate a positive definition, but never a distractor.
  // 正向定义题可用答案消歧；反选题不能按“错误项”匹配概念。
  if (exact && !isNegative(q) && q.type !== 'truefalse' && !isImageAnswer(answer)) {
    const matched = mnemonicRules.find(rule => rule.id === exact);
    if (!matches.length || matches.some(rule => rule.id === exact)) return matched;
  }
  // A question asking for a hash algorithm may mention signatures as its use case.
  if (/散列|哈希|摘要|MD5|SHA[-－]?1/i.test(stem) && /算法|函数|长度|不可逆|单向/u.test(stem)) return mnemonicRules.find(rule => rule.id === 'hash');
  return matches[0];
}

function answerCard(q, answer, negative) {
  if (!answer) return { kind: '提示', cue: '先补齐答案，再建立记忆。', meaning: '先对照原题补充参考答案，再用“关键词＋自己的例子”整理一句助记。', note: '' };
  if (isImageAnswer(answer)) return { kind: '步骤', cue: '看原图：条件 → 公式 → 代入 → 结论。', meaning: '这道题的解答在资料原图里。先从图中找已知量和求解目标，统一单位后逐步复算，再遮住解答还原关键步骤。', note: '公式、图形和上下标以答案原图为准。' };
  if (choiceTypes.includes(q.type)) return {
    kind: '关键词', cue: compact(answer, 150),
    meaning: negative ? '这是参考答案选中的例外或错误项。把它放回题干，说明它为什么不符合要求，再对照解析改正；不要把选中内容直接背成正确事实。' : q.type === 'truefalse' ? '先记住这道判断题的结论，再对照解析找出决定对错的条件；若判错，应把原句改正确后再记。' : '遮住选项字母，用这个概念回答题干。再挑一个最易混淆的选项，说明两者区别。', note: '' };
  const fill = q.type === 'fill' || /_{3,}/u.test(q.stem || '');
  if (fill) {
    const parts = answer.split(/[；;]/u).map(clean).filter(Boolean);
    if (parts.length >= 2 && parts.length <= 12 && parts.every(s => s.length <= 45)) return {
      kind: '串联', cue: compact(parts.join(' → '), 220),
      meaning: `按参考答案顺序串联${parts.length}个关键词。把每个词放回对应空格，再遮住答案按顺序复述。`, note: '箭头只表示填空顺序，不额外表示因果关系。' };
    if (answer.length <= 90) return { kind: '关键词', cue: clean(answer), meaning: '把这个词放回题干：先读题干描述，再说出术语。下一遍反过来，看到术语就解释题干中的关键特征。', note: '' };
  }
  if (q.type === 'calculation') return { kind: '步骤', cue: '已知 → 所求 → 公式 → 单位 → 代入 → 验算。', meaning: '先把题目中的量填到对应公式里，每一步保留单位，最后检查结果的大小和含义。', note: '具体数值与推导请对照当前参考答案。' };
  const points = answer.split(/[\n；;。]/u).map(s => clean(s).replace(/^(?:[（(]?\d+[）).、．]|[①②③④⑤⑥⑦⑧⑨⑩])\s*/u, '')).filter(Boolean);
  const headings = points.map(s => {
    const head = s.split(/[：:]/u)[0];
    return head.length <= 24 ? head : s.length <= 36 ? s : '';
  }).filter(Boolean);
  if (headings.length >= 2) return { kind: '串联', cue: compact([...new Set(headings)].slice(0, 5).join(' → '), 200), meaning: '把这些答题要点想成沿路的几个站点：依次回忆，每站再补一句含义或条件。', note: '这是部分要点索引，完整内容仍以当前答案为准。' };
  return { kind: '关键词', cue: compact(clean(answer), 120), meaning: '先记住这段话里的主体和动作，再把条件补回去。尝试用“它是什么 → 起什么作用 → 在什么条件下”复述。', note: answer.length > 120 ? '上面只摘出答案开头，展开参考答案查看全文。' : '' };
}

export function mnemonicDetails(q) {
  const custom = typeof q.mnemonic === 'string' ? q.mnemonic.trim() : '';
  if (custom) return { custom: true, cards: [{ kind: '自定义', cue: '', meaning: custom, note: '' }], warning: '', reference: null };
  const answer = answerWords(q);
  const negative = isNegative(q);
  const warning = negative ? '先圈出否定词：本题找例外或错误项，选中的内容不一定是正确知识。' : q.type === 'truefalse' && /错误|错|false|×|✗/iu.test(answer) ? '这道题的判断为错，记忆前先对照解析改正原句。' : '';
  const rule = answer ? matchRule(q, answer) : null;
  const fallback = answerCard(q, answer, negative);
  const cards = rule ? [...rule.cards.map(card => ({ ...card })), { ...fallback, kind: `本题${fallback.kind}` }] : [fallback];
  return {
    custom: false, ruleId: rule?.id || null, cards, warning,
    reference: rule ? { title: rule.title, book: '计算机网络与信息安全（2024 年版，李全龙）', pages: [...rule.pages], pdfPages: rule.pages.map(page => page + 7) } : null,
  };
}

// Compact text remains compatible with editor placeholders, history and exports.
// 编辑框提示、历史版本等保留纯文本接口；实时取当前答案，不写回原始题库。
export function automaticMnemonic(q) {
  const details = mnemonicDetails({ ...q, mnemonic: '' });
  const card = details.cards[0];
  return [details.warning, card.cue, card.meaning, card.note].filter(Boolean).join('\n');
}
export function mnemonicText(q) {
  return q.mnemonic?.trim() || automaticMnemonic(q);
}
