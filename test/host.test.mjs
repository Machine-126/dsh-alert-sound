// Host-half tests: request validation, SSML escaping, origin trust and the
// route's error paths. Everything here runs offline — the networked synthesis
// itself is covered by the opt-in case at the end, which stays off unless
// DSH_ALERT_SOUND_TEST_NETWORK=1 is set.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'

import { apply, internals } from '../lib/index.mjs'

const { ROUTE_PATH, parseRequest, isSameOriginRequest, buildSsml, escapeSsml, normalizeText } = internals

/** Build the parsed-URL argument parseRequest takes. */
function url(query) {
  return new URL(`${ROUTE_PATH}${query}`, 'http://127.0.0.1:3080')
}

test('parseRequest accepts a minimal request and applies the documented defaults', () => {
  const parsed = parseRequest(url('?text=%E9%9C%80%E8%A6%81%E5%AE%A1%E6%89%B9'))
  assert.deepEqual(parsed, { text: '需要审批', voice: 'zh-CN-XiaoxiaoNeural', ratePercent: 0 })
})

test('parseRequest clamps the rate and rejects out-of-range parameters', () => {
  assert.equal(parseRequest(url('?text=hi&rate=-999')).ratePercent, -50)
  assert.equal(parseRequest(url('?text=hi&rate=999')).ratePercent, 100)
  assert.equal(parseRequest(url('?text=hi&rate=-30')).ratePercent, -30)
  assert.ok('error' in parseRequest(url('?text=hi&rate=abc')))
  assert.ok('error' in parseRequest(url('?voice=zh-CN-XiaoxiaoNeural')))
  assert.ok('error' in parseRequest(url(`?text=${'x'.repeat(401)}`)))
})

test('parseRequest refuses a voice name that could inject SSML', () => {
  const injected = encodeURIComponent(`x'/><prosody rate='+100%'`)
  assert.ok('error' in parseRequest(url(`?text=hi&voice=${injected}`)))
  assert.ok('error' in parseRequest(url('?text=hi&voice=zh-CN-XiaoxiaoNeural<foo>')))
})

test('normalizeText strips control characters the service rejects', () => {
  assert.equal(normalizeText('  a\u0000b\tc  '), 'a b c')
})

test('escapeSsml neutralizes every XML-significant character', () => {
  assert.equal(escapeSsml(`a<b>&"'`), 'a&lt;b&gt;&amp;&quot;&apos;')
})

test('buildSsml places escaped text inside one prosody element', () => {
  const ssml = buildSsml('a<b', 'zh-CN-XiaoxiaoNeural', -20)
  assert.match(ssml, /<prosody pitch='\+0Hz' rate='-20%' volume='\+0%'>a&lt;b<\/prosody>/)
  assert.match(buildSsml('hi', 'zh-CN-XiaoxiaoNeural', 30), /rate='\+30%'/)
})

test('isSameOriginRequest refuses cross-site and foreign-origin requests', () => {
  const host = '127.0.0.1:3080'
  assert.equal(isSameOriginRequest({ headers: { host } }), true)
  assert.equal(isSameOriginRequest({ headers: { host, 'sec-fetch-site': 'same-origin' } }), true)
  assert.equal(isSameOriginRequest({ headers: { host, 'sec-fetch-site': 'cross-site' } }), false)
  assert.equal(isSameOriginRequest({ headers: { host, origin: 'http://evil.example' } }), false)
  assert.equal(isSameOriginRequest({ headers: { host, origin: 'http://127.0.0.1:3080' } }), true)
})

/** Register the route through a stub host, then serve it over a real socket. */
async function withRoute(run) {
  let route
  apply({
    inject: (_services, callback) => callback({
      get: () => ({ register: (registered) => { route = registered; return () => { route = undefined } } }),
      effect: (fn) => fn(),
    }),
  })
  assert.equal(route.path, ROUTE_PATH)
  const server = createServer((req, res) => route.handler(req, res))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    await run(`http://127.0.0.1:${server.address().port}`)
  } finally {
    server.close()
  }
}

test('the route answers 400/403/405 without ever synthesizing', async () => {
  await withRoute(async (base) => {
    const bad = await fetch(`${base}${ROUTE_PATH}?voice=zh-CN-XiaoxiaoNeural`)
    assert.equal(bad.status, 400)
    const crossSite = await fetch(`${base}${ROUTE_PATH}?text=hi`, { headers: { 'sec-fetch-site': 'cross-site' } })
    assert.equal(crossSite.status, 403)
    const post = await fetch(`${base}${ROUTE_PATH}?text=hi`, { method: 'POST' })
    assert.equal(post.status, 405)
  })
})

test('the route reports a synthesis failure as 502', async () => {
  await withRoute(async (base) => {
    // An empty voice name passes neither the pattern nor the network: the route
    // must answer an error rather than hang or throw.
    const res = await fetch(`${base}${ROUTE_PATH}?text=hi&voice=${encodeURIComponent('xx-XX-NopeNeural')}`)
    assert.equal(res.status, 502)
  })
})

test('synthesis over the live service returns playable MP3', { skip: process.env.DSH_ALERT_SOUND_TEST_NETWORK !== '1' }, async () => {
  const { audioFor } = internals
  const { audio, engine } = await audioFor('输出完成', 'zh-CN-XiaoxiaoNeural', 0)
  assert.equal(engine, 'synthesized')
  assert.ok(audio.length > 1000)
  assert.equal(audio.subarray(0, 2).toString('hex'), 'fff3')
  const cached = await audioFor('输出完成', 'zh-CN-XiaoxiaoNeural', 0)
  assert.equal(cached.engine, 'cache')
  assert.ok(cached.audio.equals(audio))
})
