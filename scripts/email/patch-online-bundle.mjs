// Apply the email-only delta to a downloaded live bundle; never rebuild unrelated routes.
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/email/patch-online-bundle.mjs input output');
const original = await fs.readFile(input, 'utf8');
const sections = ['// apps/server/src/lib/web-mail.ts\n', '// apps/server/src/routes/web-accounts.ts\n', '// apps/server/src/routes/web-locations.ts\n', '// candidate-entry.ts\n'];
for (const marker of sections) if (original.split(marker).length !== 2) throw new Error('Unexpected live section graph');
const renderer = await build({ entryPoints: ['apps/server/src/lib/transactional-email/render.ts'], bundle: true, format: 'iife', globalName: 'TakomenuEmail20261019', platform: 'neutral', target: 'es2022', write: false });
let result = original;
const replaceOnce = (before, after) => {
  if (result.split(before).length !== 2) throw new Error('Live patch precondition failed');
  result = result.replace(before, after);
};
const a = result.indexOf(sections[0]), b = result.indexOf(sections[1]), c = result.indexOf(sections[2]);
const transport = result.slice(a, b);
const oldBody = 'from: process.env.EMAIL_FROM,\n          ...mail';
if (transport.split(oldBody).length !== 2) throw new Error('Unexpected mail transport');
replaceOnce(transport, transport.replace(oldBody, 'from: process.env.EMAIL_FROM,\n          reply_to: process.env.EMAIL_REPLY_TO || "manuelrizzo474@gmail.com",\n          ...mail'));
const accountSection = original.slice(b, c);
const assignmentStart = accountSection.indexOf('    resetLinkMail = '), assignmentEnd = accountSection.indexOf('    activeReset = ');
if (assignmentStart < 0 || assignmentEnd < assignmentStart) throw new Error('Missing current reset helpers');
const helpers = `    resetLinkMail = (url, name = "ristoratore") => TakomenuEmail20261019.renderTransactionalEmail("reset-password", {nome_titolare: name, minuti_validita: String(RESET_LINK_TTL_MINUTES), link_reset: url}, process.env.EMAIL_LOGO_URL);
    passwordChangedMail = (name = "ristoratore") => TakomenuEmail20261019.renderTransactionalEmail("password-cambiata", {nome_titolare: name, data_ora: new Date().toLocaleString("it-IT", {timeZone:"Europe/Rome"})}, process.env.EMAIL_LOGO_URL);
`;
const updatedAccount = accountSection.slice(0, assignmentStart) + helpers + accountSection.slice(assignmentEnd);
replaceOnce(accountSection, updatedAccount);
replaceOnce('...resetLinkMail(origin6.replace(/\\/$/, "") + "/staff/?reset=" + token2)', '...resetLinkMail(origin6.replace(/\\/$/, "") + "/staff/?reset=" + token2, user.name)');
replaceOnce('  "TAKO_PRESET_CRON_SECRET"\n]){', '  "TAKO_PRESET_CRON_SECRET",\n  "WEB_EMAIL_ENABLED",\n  "RESEND_API_KEY",\n  "EMAIL_FROM",\n  "EMAIL_REPLY_TO",\n  "EMAIL_LOGO_URL"\n]){');
replaceOnce(sections[1], '// Takomenu transactional email renderer — 2026-10-19\n' + renderer.outputFiles[0].text + '\n' + sections[1]);
// All existing module sections outside these three must remain byte-for-byte identical.
const split = text => new Map([...text.matchAll(/^\/\/ ([^\n]+)\n/gm)].map((m, i, all) => [m[1], text.slice(m.index, all[i + 1]?.index ?? text.length)]));
const oldSections = split(original), newSections = split(result), allowed = new Set(['apps/server/src/lib/web-mail.ts','apps/server/src/routes/web-accounts.ts','candidate-entry.ts']);
const changed = [];
for (const [name, body] of oldSections) {
  if (body !== newSections.get(name)) {
    if (!allowed.has(name)) throw new Error('Unrelated module changed: ' + name);
    changed.push(name);
  }
}
await fs.mkdir(new URL('../../release/serverless/candidate/', import.meta.url), {recursive:true});
await fs.writeFile(output, result, {mode:0o600});
console.log(JSON.stringify({baseSha256:createHash('sha256').update(original).digest('hex'), candidateSha256:createHash('sha256').update(result).digest('hex'), preservedModules:oldSections.size-changed.length, changed, deployed:false}));
