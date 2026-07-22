/**
 * minimax-client.ts
 *
 * Direct MiniMax API client for Hailuo-02 text-to-video generation.
 * No fal.ai, no third-party wrappers.
 *
 * Flow: submit → poll status (task_id) → fetch file URL (file_id)
 *
 * API docs: https://www.minimax.io/platform/document/video-generation
 * Auth: Authorization: Bearer <MINIMAX_API_KEY>
 */

const MINIMAX_API_BASE = process.env.MINIMAX_BASE_URL || "https://api.minimaxi.chat/v1";
const MODEL = process.env.VIDEO_MODEL || "MiniMax-Hailuo-2.3-Fast";

export class MiniMaxError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "MiniMaxError";
  }
}

export interface SubmitResult {
  task_id: string;
}

export interface TaskStatus {
  task_id: string;
  status: "Preparing" | "Queueing" | "Processing" | "Success" | "Fail";
  file_id?: string;
  err_code?: number;
  err_msg?: string;
}

function getKey(): string {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new MiniMaxError("MINIMAX_API_KEY is not set");
  return key;
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getKey()}`,
  };
}

/**
 * Step 1 — Submit a text-to-video generation task.
 * Returns a task_id to track progress.
 */
export async function submitVideo(
  prompt: string,
  durationSeconds: 6 | 10 = 6,
  enhancePrompt: boolean = true,
  callbackUrl?: string
): Promise<SubmitResult> {
  const body: Record<string, any> = {
    model: MODEL,
    prompt,
    duration: durationSeconds,
    enhance_prompt: enhancePrompt,
  };

  if (callbackUrl) {
    body.callback_url = callbackUrl;
  }

  const res = await fetch(`${MINIMAX_API_BASE}/video_generation`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MiniMaxError(
      `MiniMax submit failed (${res.status}): ${body}`,
      res.status
    );
  }

  const data = await res.json();
  if (!data.task_id) {
    throw new MiniMaxError(
      `MiniMax submit response missing task_id: ${JSON.stringify(data)}`
    );
  }

  return { task_id: data.task_id };
}

/**
 * Step 2 — Query the status of a generation task.
 * Poll this until status === "Success" (get file_id) or "Fail".
 */
export async function queryTaskStatus(task_id: string): Promise<TaskStatus> {
  const url = new URL(`${MINIMAX_API_BASE}/query/video_generation`);
  url.searchParams.set("task_id", task_id);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MiniMaxError(
      `MiniMax status query failed (${res.status}): ${body}`,
      res.status
    );
  }

  const data = await res.json();
  return {
    task_id: data.task_id ?? task_id,
    status: data.status,
    file_id: data.file_id,
    err_code: data.err_code,
    err_msg: data.err_msg,
  };
}

/**
 * Step 3 — Retrieve the download URL from a completed file_id.
 * Note: URLs are time-limited (~9 hours). Save the file to your own storage ASAP.
 */
export async function getVideoUrl(file_id: string): Promise<string> {
  const url = new URL(`${MINIMAX_API_BASE}/files/retrieve`);
  url.searchParams.set("file_id", file_id);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MiniMaxError(
      `MiniMax file retrieve failed (${res.status}): ${body}`,
      res.status
    );
  }

  const data = await res.json();
  const downloadUrl = data.file?.download_url ?? data.download_url;
  if (!downloadUrl) {
    throw new MiniMaxError(
      `MiniMax file response missing download_url: ${JSON.stringify(data)}`
    );
  }

  return downloadUrl;
}
