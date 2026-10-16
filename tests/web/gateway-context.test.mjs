import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyGatewayContext} from '../../scripts/serverless/gateway-context.mjs';
const cfg={secret:'fixture-secret-over-thirty-two-characters',origin:'https://takoitalia.com'};
const req=(extra={})=>new Request('https://example.supabase.co/functions/v1/api',{headers:{'x-tako-gateway-secret':cfg.secret,'x-tako-gateway-origin':cfg.origin,'x-tako-client-ip':'203.0.113.2',...extra}});
test('authenticated gateway context accepts IP and rejects forged origin, secret and proxy chains',()=>{assert.equal(verifyGatewayContext(req(),cfg).ip,'203.0.113.2');for(const headers of [{'x-tako-gateway-secret':'wrong'},{'x-tako-gateway-origin':'https://evil.test'},{'x-tako-client-ip':'203.0.113.2, 127.0.0.1'},{'x-tako-client-ip':'999.1.2.3'},{'x-tako-client-ip':'localhost'}])assert.equal(verifyGatewayContext(req(headers),cfg),null);assert.throws(()=>verifyGatewayContext(req(),{...cfg,secret:''}),/missing/);});
