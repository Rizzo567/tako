import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStaticRoute} from '../../apps/web-static/src/routes.mjs';
for(const kind of ['onboarding-preview','onboarding-claim']) {
 test(`${kind} keeps opaque token separate from restaurant routing`,()=>assert.deepEqual(parseStaticRoute(`/${kind}/private-token_123`),{kind,token:'private-token_123'}));
 for(const token of ['%2Fadmin','%5Cadmin','%00','..','%E0%A4%A'])test(`${kind} rejects unsafe token ${token}`,()=>assert.deepEqual(parseStaticRoute(`/${kind}/${token}`),{kind:'not-found'}));
}
