import { fal } from '@fal-ai/client';
import * as tweetnacl from 'tweetnacl';
import crypto from 'crypto';

const MODEL_STANDARD = "fal-ai/minimax/hailuo-02/standard/text-to-video";
const MODEL_PRO = "fal-ai/minimax/hailuo-02/pro/text-to-video";

const ALLOWED_DURATIONS = new Set(["6", "10"]);

export class MiniMaxSubmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MiniMaxSubmitError';
  }
}

export interface SubmitResult {
  request_id: string;
  model: string;
}

export async function submitVideo(
  prompt: string,
  webhookUrl: string,
  duration: string = "6",
  usePro: boolean = false,
  promptOptimizer: boolean = true
): Promise<SubmitResult> {
  if (!ALLOWED_DURATIONS.has(duration)) {
    throw new Error(`duration must be one of ${Array.from(ALLOWED_DURATIONS)}, got ${duration}`);
  }
  if (duration === "10" && usePro) {
    throw new Error("10 second clips are not supported on the pro (1080p) tier");
  }

  const model = usePro ? MODEL_PRO : MODEL_STANDARD;

  try {
    const handle = await fal.queue.submit(model, {
      input: {
        prompt,
        duration: duration as '6' | '10',
        prompt_optimizer: promptOptimizer,
      },
      webhookUrl: webhookUrl,
    });
    return { request_id: handle.request_id, model };
  } catch (err: any) {
    throw new MiniMaxSubmitError(`Fal.ai submission failed: ${err.message}`);
  }
}

export async function pollVideoResult(requestId: string, model: string = MODEL_STANDARD): Promise<any | null> {
  const statusResult = await fal.queue.status(model, { requestId, logs: false }) as any;
  if (statusResult.status === 'COMPLETED') {
    return await fal.queue.result(model, { requestId });
  }
  if (statusResult.status === 'IN_PROGRESS' || statusResult.status === 'IN_QUEUE') {
    return null;
  }
  throw new MiniMaxSubmitError(`Hailuo render failed or errored: ${statusResult.status}`);
}

export function extractVideoUrl(resultPayload: any): string {
  try {
    return resultPayload.video.url;
  } catch (err: any) {
    throw new MiniMaxSubmitError(`Unexpected result shape from Fal.ai: ${JSON.stringify(resultPayload)}`);
  }
}

const _JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
let _jwks_cache: any[] = [];
let _jwks_cache_fetched_at = 0;
const _JWKS_CACHE_SECONDS = 24 * 60 * 60;
const _TIMESTAMP_LEEWAY_SECONDS = 300;

async function getJwks(): Promise<any[]> {
  const now = Date.now() / 1000;
  if (_jwks_cache.length > 0 && (now - _jwks_cache_fetched_at) < _JWKS_CACHE_SECONDS) {
    return _jwks_cache;
  }
  const res = await fetch(_JWKS_URL);
  if (!res.ok) throw new Error("Failed to fetch JWKS");
  const data = await res.json();
  _jwks_cache = data.keys || [];
  _jwks_cache_fetched_at = now;
  return _jwks_cache;
}

function b64urlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLength);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

export async function verifyFalWebhook(
  requestId: string,
  userId: string,
  timestamp: string,
  signatureHex: string,
  rawBody: Buffer
): Promise<boolean> {
  const now = Date.now() / 1000;
  if (Math.abs(now - parseInt(timestamp, 10)) > _TIMESTAMP_LEEWAY_SECONDS) {
    console.warn("Fal webhook rejected: timestamp outside leeway");
    return false;
  }

  const signature = Buffer.from(signatureHex, 'hex');
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  
  const message = [
    requestId,
    userId,
    timestamp,
    bodyHash
  ].join('\n');
  const messageBytes = new Uint8Array(Buffer.from(message, 'utf-8'));

  try {
    const keys = await getJwks();
    for (const key of keys) {
      if (key.kty === 'OKP' && key.crv === 'Ed25519' && key.x) {
        const publicKeyBytes = b64urlDecode(key.x);
        try {
          const isValid = tweetnacl.sign.detached.verify(messageBytes, signature, publicKeyBytes);
          if (isValid) return true;
        } catch (err) {
          // Ignore verification error
        }
      }
    }
  } catch (err) {
    console.error("JWKS fetch error", err);
  }

  return false;
}
