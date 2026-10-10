import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizePath, stripLocalePrefix, localeFromPath } from '../../src/paths.js';
test('Shanyao navigation and share links always retain their base', () => {
  assert.equal(localizePath('/', 'zh-CN'), '/shanyao/');
  assert.equal(localizePath('/posts/abc/route', 'en'), '/shanyao/en/posts/abc/route');
  assert.equal(localizePath('/shanyao/en/places/abc', 'ja'), '/shanyao/ja/places/abc');
  assert.equal(localizePath('/shanyao/auth/reset-password', 'zh-CN'), '/shanyao/auth/reset-password');
  assert.equal(stripLocalePrefix('/shanyao/ja/posts/abc'), '/posts/abc');
  assert.equal(stripLocalePrefix('/shanyao/'), '/');
  assert.equal(localeFromPath('/shanyao/en/'), 'en');
  assert.equal(localeFromPath('/shanyao/ja/profile'), 'ja');
  assert.equal(localeFromPath('/shanyao/'), 'zh-CN');
});
