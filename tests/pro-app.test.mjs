import assert from 'node:assert/strict';
import test from 'node:test';

import { injectProGrant, PRO_PLAN_GRANTED, PRO_PLAN_PLACEHOLDER } from '../server/pro-app.mjs';

test('injectProGrant replaces exactly one free placeholder with one verified Pro grant', () => {
  const result = injectProGrant(`<!doctype html><head>${PRO_PLAN_PLACEHOLDER}</head>`);
  assert.equal(result.split(PRO_PLAN_GRANTED).length - 1, 1);
  assert.equal(result.split(PRO_PLAN_PLACEHOLDER).length - 1, 0);
});

test('injectProGrant fails closed when the placeholder is missing or duplicated', () => {
  assert.throws(() => injectProGrant('<!doctype html><head></head>'), /authorization marker is invalid/);
  assert.throws(
    () => injectProGrant(`${PRO_PLAN_PLACEHOLDER}${PRO_PLAN_PLACEHOLDER}`),
    /authorization marker is invalid/
  );
});

test('injectProGrant rejects a template that already contains an active Pro marker', () => {
  const active = '<meta name="whiteboard-plan" content="pro">';
  assert.throws(() => injectProGrant(`${PRO_PLAN_PLACEHOLDER}${active}`), /authorization marker is invalid/);
});
