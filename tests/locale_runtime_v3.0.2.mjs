import assert from 'node:assert/strict';

const storage = new Map([['nnc_lang_v1', 'ru']]);
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value))
};

const { locLabel, optionDesc } = await import('../src/i18n.v2-1.js');

assert.equal(locLabel('WPN GOOD · 2 SLOTS'), 'ОРУЖИЕ ХОРОШИЙ · 2 СЛОТЫ');
assert.equal(locLabel('CURSE: STATIC STORM'), 'ПРОКЛЯТИЕ: СТАТИК-ШТОРМ');
assert.equal(locLabel('GLD +50'), 'КРЕДИТЫ +50');
assert.equal(locLabel('LOOT x2'), 'ДОБЫЧА x2');
assert.equal(optionDesc({ id: 'paired', desc: 'canonical', descRu: 'Русское описание.', descEn: 'English description.' }), 'Русское описание.');

storage.set('nnc_lang_v1', 'en');
assert.equal(locLabel('WPN GOOD · 2 SLOTS'), 'WPN GOOD · 2 SLOTS');
assert.equal(locLabel('CURSE: STATIC STORM'), 'CURSE: STATIC STORM');
assert.equal(optionDesc({ id: 'paired', desc: 'canonical', descRu: 'Русское описание.', descEn: 'English description.' }), 'English description.');
assert.doesNotMatch(optionDesc({ id: 'paired', descRu: 'Русское описание.', descEn: 'English description.' }), /[А-Яа-яЁё]/);

console.log('v3.0.2 runtime locale helpers passed: chest receipts and paired descriptions switch cleanly');
