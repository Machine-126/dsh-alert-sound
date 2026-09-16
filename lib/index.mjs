// dsh-alert-sound — Host half.
//
// The browser half owns every notification decision, the tones, the settings
// section and both voice engines. This half contributes exactly one thing:
// GET /dsh-alert-sound/tts.mp3, which turns text into speech with Microsoft
// Edge's read-aloud service and answers with MP3 bytes. It performs no network
// work until the browser half asks for one synthesis, and the browser half only
// asks while the “Edge” voice engine is selected.
//
// Why the synthesis is not in the browser: the read-aloud WebSocket rejects a
// handshake whose Origin is a page (HTTP 403) and requires a browser-like
// User-Agent, which a page cannot set. A Node client satisfies both, so the
// browser asks this route and plays the returned audio.
//
// The route path and the service constants below are protocol facts shared
// with the browser half; they are not deployment settings.

import { createRequire } from 'node:module'
import { createHash, randomUUID } from 'node:crypto'

export const name = 'dsh-alert-sound'

/** Absolute path of the synthesis route, shared with the browser half. */
const ROUTE_PATH = '/dsh-alert-sound/tts.mp3'
/** Voice used when a request omits `voice`. */
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'
/** Edge read-aloud service constants (verified against edge-tts 7.2.7). */
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const WSS_ENDPOINT = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
  + ` Chrome/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0 Safari/537.36`
  + ` Edg/${CHROMIUM_FULL_VERSION.split('.')[0]}.0.0.0`
const AUDIO_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
/** Speech rate bounds as Edge accepts them, in percent. */
const MIN_RATE_PERCENT = -50
const MAX_RATE_PERCENT = 100
/** Longest text one request may carry; the browser half clips read-aloud to this. */
const MAX_TEXT_CHARS = 400
const SYNTHESIS_TIMEOUT_MS = 15000
const CACHE_MAX_ENTRIES = 128
const CACHE_BYTES = 24 * 1024 * 1024
/** Voice names the service accepts, and the only place a request may inject SSML. */
const VOICE_PATTERN = /^[a-z]{2,3}-[A-Za-z]{2,4}-[A-Za-z0-9]{2,40}Neural$/

const requireFromHere = createRequire(import.meta.url)

// ---- speech synthesis ------------------------------------------------------

/**
 * Escape text for the SSML body. The service parses the request as XML, so a
 * reply containing `<` or `&` would otherwise corrupt or inject markup.
 * @param text - Raw text to speak.
 * @returns The same text with XML-significant characters replaced.
 */
function escapeSsml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
}

/**
 * Strip characters the service rejects and collapse whitespace.
 * @param text - Raw request text.
 * @returns Text safe to place inside one SSML prosody element.
 */
function normalizeText(text) {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Build the SSML request for one synthesis.
 * @param text - Normalized, unescaped text.
 * @param voice - Validated voice name.
 * @param ratePercent - Speech rate in percent, already clamped.
 * @returns The SSML document.
 */
function buildSsml(text, voice, ratePercent) {
  return "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
    + `<voice name='${voice}'><prosody pitch='+0Hz' rate='${ratePercent >= 0 ? '+' : ''}${ratePercent}%' volume='+0%'>`
    + `${escapeSsml(text)}</prosody></voice></speak>`
}

/**
 * Compute the Sec-MS-GEC token the service requires: current Windows file time
 * rounded down to five minutes, concatenated with the trusted client token and
 * SHA-256 hashed.
 * @returns Uppercase hex digest.
 */
function secMsGec() {
  const windowsEpochSeconds = 11644473600
  let ticks = Math.floor(Date.now() / 1000) + windowsEpochSeconds
  ticks -= ticks % 300
  return createHash('sha256').update(`${(ticks * 1e7).toFixed(0)}${TRUSTED_CLIENT_TOKEN}`, 'ascii').digest('hex').toUpperCase()
}

/**
 * Format a JavaScript-style timestamp for the request headers. The service
 * expects the same value with a trailing `Z` on the SSML request only.
 * @returns Timestamp string in the exact form the service expects.
 */
function requestTimestamp() {
  return new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)')
}

/**
 * Splice the audio payload out of one binary WebSocket message, whose first two
 * bytes give the length of the header block preceding the payload.
 * @param message - One binary frame from the service.
 * @returns Audio bytes carried by that frame.
 */
function audioPayload(message) {
  const buffer = Buffer.isBuffer(message) ? message : Buffer.from(message)
  const headerLength = buffer.readUInt16BE(0)
  return buffer.subarray(2 + headerLength)
}

/**
 * Synthesize speech over the Edge read-aloud WebSocket.
 * @param text - Normalized, unescaped text.
 * @param voice - Validated voice name.
 * @param ratePercent - Speech rate in percent, already clamped.
 * @returns Resolves with MP3 bytes.
 */
async function synthesize(text, voice, ratePercent) {
  const WebSocket = requireFromHere('ws')
  const connectionId = randomUUID().replace(/-/g, '')
  const url = `${WSS_ENDPOINT}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`
    + `&ConnectionId=${connectionId}`
    + `&Sec-MS-GEC=${secMsGec()}`
    + `&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`
  const socket = new WebSocket(url, { headers: { 'User-Agent': USER_AGENT }, handshakeTimeout: SYNTHESIS_TIMEOUT_MS })
  const chunks = []
  return await new Promise((resolve, reject) => {
    const finish = (error, audio) => {
      clearTimeout(timer)
      socket.removeAllListeners()
      try { socket.terminate() } catch { /* the socket is already gone */ }
      if (error) reject(error)
      else resolve(audio)
    }
    const timer = setTimeout(() => finish(new Error('Edge speech synthesis timed out')), SYNTHESIS_TIMEOUT_MS)
    socket.on('open', () => {
      const timestamp = requestTimestamp()
      socket.send(`X-Timestamp:${requestTimestamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`
        + `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},`
        + `"outputFormat":"${AUDIO_FORMAT}"}}}}\r\n`)
      socket.send(`X-RequestId:${randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\n`
        + `X-Timestamp:${timestamp}Z\r\nPath:ssml\r\n\r\n${buildSsml(text, voice, ratePercent)}`)
    })
    socket.on('message', (message, isBinary) => {
      if (isBinary) {
        chunks.push(audioPayload(message))
        return
      }
      if (String(message).includes('Path:turn.end')) finish(undefined, Buffer.concat(chunks))
    })
    socket.on('error', (error) => finish(error))
    socket.on('close', (code) => finish(new Error(`the speech socket closed early (code ${code})`)))
  })
}


/** Insertion-ordered synthesis cache with an entry and byte ceiling. */
class AudioCache {
  #entries = new Map()
  #bytes = 0

  /**
   * @param key - Cache key of one synthesis request.
   * @returns The cached audio, or undefined.
   */
  get(key) {
    const entry = this.#entries.get(key)
    if (entry === undefined) return undefined
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return entry
  }

  /**
   * @param key - Cache key of one synthesis request.
   * @param audio - MP3 bytes to retain.
   */
  set(key, audio) {
    this.#entries.set(key, audio)
    this.#bytes += audio.length
    while (this.#entries.size > CACHE_MAX_ENTRIES || this.#bytes > CACHE_BYTES) {
      const oldest = this.#entries.keys().next()
      if (oldest.done === true) break
      const evicted = this.#entries.get(oldest.value)
      this.#entries.delete(oldest.value)
      this.#bytes -= evicted.length
    }
  }
}

const cache = new AudioCache()
const inFlight = new Map()

/**
 * Produce MP3 audio for one request, reusing a completed or in-flight
 * synthesis of the same text, voice and rate.
 * @param text - Normalized, unescaped text.
 * @param voice - Validated voice name.
 * @param ratePercent - Speech rate in percent, already clamped.
 * @returns MP3 bytes plus the engine that produced them.
 */
async function audioFor(text, voice, ratePercent) {
  const key = `${voice}|${ratePercent}|${text}`
  const cached = cache.get(key)
  if (cached !== undefined) return { audio: cached, engine: 'cache' }
  const pending = inFlight.get(key)
  if (pending !== undefined) return { audio: await pending, engine: 'shared' }
  const work = synthesize(text, voice, ratePercent)
  inFlight.set(key, work)
  try {
    const audio = await work
    if (audio.length === 0) throw new Error('Edge speech synthesis returned no audio')
    cache.set(key, audio)
    return { audio, engine: 'synthesized' }
  } finally {
    inFlight.delete(key)
  }
}

// ---- HTTP route ------------------------------------------------------------

/**
 * Reject requests that a page on another site issued. The server is loopback
 * only, so this guards against a local page driving synthesis through the
 * browser's ability to send a cross-site request.
 * @param req - Incoming request.
 * @returns Whether the request came from this origin or a non-browser client.
 */
function isSameOriginRequest(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return true
  return origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`
}

/**
 * Send a JSON error body.
 * @param res - Response to write.
 * @param status - HTTP status code.
 * @param message - Human-readable reason.
 */
function fail(res, status, message) {
  const body = JSON.stringify({ error: message })
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) })
  res.end(body)
}

/**
 * Read and validate the request parameters.
 * @param url - Parsed request URL.
 * @returns Valid parameters, or the reason the request is invalid.
 */
function parseRequest(url) {
  const text = normalizeText(url.searchParams.get('text') ?? '')
  if (text === '') return { error: 'text is required' }
  if (text.length > MAX_TEXT_CHARS) return { error: `text exceeds ${MAX_TEXT_CHARS} characters` }
  const voice = url.searchParams.get('voice') ?? DEFAULT_VOICE
  if (!VOICE_PATTERN.test(voice)) return { error: 'voice is not a supported name' }
  const rawRate = url.searchParams.get('rate')
  const ratePercent = rawRate === null ? 0 : Math.trunc(Number(rawRate))
  if (!Number.isFinite(ratePercent)) return { error: 'rate must be a number' }
  return {
    text,
    voice,
    ratePercent: Math.min(MAX_RATE_PERCENT, Math.max(MIN_RATE_PERCENT, ratePercent)),
  }
}

/**
 * Answer one synthesis request.
 * @param req - Incoming request.
 * @param res - Response owning audio bytes or a JSON error.
 */
async function handleSynthesis(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }
  if (!isSameOriginRequest(req)) {
    fail(res, 403, 'cross-site request refused')
    return
  }
  const url = new URL(req.url ?? ROUTE_PATH, `http://${req.headers.host ?? '127.0.0.1'}`)
  const parsed = parseRequest(url)
  if ('error' in parsed) {
    fail(res, 400, parsed.error)
    return
  }
  try {
    const { audio, engine } = await audioFor(parsed.text, parsed.voice, parsed.ratePercent)
    res.writeHead(200, {
      'content-type': 'audio/mpeg',
      'content-length': audio.length,
      'cache-control': 'no-store',
      'x-dsh-alert-sound-engine': engine,
      'x-dsh-alert-sound-voice': parsed.voice,
    })
    res.end(req.method === 'HEAD' ? undefined : audio)
  } catch (error) {
    fail(res, 502, error instanceof Error ? error.message : 'Edge speech synthesis failed')
  }
}

/**
 * Register the synthesis route for as long as this plugin is active.
 * @param ctx - Harness context owning the Web server.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (scope) => {
    const webServer = scope.get('webServer')
    if (!webServer) return
    scope.effect(
      () => webServer.register({ kind: 'exact', path: ROUTE_PATH, handler: handleSynthesis }),
      'dsh-alert-sound: Edge speech synthesis route',
    )
  })
}

/** Test seam: the validation, SSML and routing pieces a test drives directly. */
export const internals = { ROUTE_PATH, DEFAULT_VOICE, parseRequest, isSameOriginRequest, buildSsml, escapeSsml, normalizeText, audioFor }
