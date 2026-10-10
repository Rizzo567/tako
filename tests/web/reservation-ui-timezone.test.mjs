import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('reservation editor displays restaurant time across DST, independent of browser timezone',()=>{
 const source=readFileSync('apps/dashboard/public/staff/src/09-reservations.js','utf8');
 const helpers=source.slice(source.indexOf('const resTimezone'),source.indexOf('/* tutti i tavoli'));
 const context={SETTINGS_DEFAULTS:{fuso:'Europe/Rome'}};
 const value=runInNewContext(helpers+`;[resIsoToLocalInput('2026-03-29T17:00:00Z'),resIsoToLocalInput('2026-10-25T18:00:00Z'),resHHMM('2026-03-29T17:00:00Z')]`,context);
 assert.deepEqual(Array.from(value),['2026-03-29T19:00','2026-10-25T19:00','19:00']);
 context.SETTINGS_DEFAULTS.fuso='America/New_York';
 assert.equal(runInNewContext(`resIsoToLocalInput('2026-03-29T17:00:00Z')`,context),'2026-03-29T13:00');
});
