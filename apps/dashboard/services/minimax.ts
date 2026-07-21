const BASE_URL = () => process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.chat/v1'

function authHeaders() {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY is not configured')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

// ─── Step 1: Create task ─────────────────────────────────────────────────────

export interface MiniMaxVideoParams {
  prompt: string
}

export interface MiniMaxCreateResponse {
  task_id: string
  status: string
}

export async function generateMiniMaxVideo(params: MiniMaxVideoParams): Promise<MiniMaxCreateResponse> {
  const response = await fetch(`${BASE_URL()}/video_generation`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model: process.env.VIDEO_MODEL || 'MiniMax-Hailuo-2.3-Fast',
      prompt: params.prompt,
    }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MiniMax create error: ${response.status} ${error}`)
  }
  return response.json()
}

// ─── Step 2: Query task status ───────────────────────────────────────────────

export type MiniMaxTaskStatus = 'Queueing' | 'Processing' | 'Success' | 'Fail'

export interface MiniMaxTaskResponse {
  task_id: string
  status: MiniMaxTaskStatus
  file_id?: string  // present when status === 'Success'
  err_code?: number
  err_msg?: string
}

export async function queryVideoTask(taskId: string): Promise<MiniMaxTaskResponse> {
  const response = await fetch(
    `${BASE_URL()}/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
    { headers: authHeaders() }
  )
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MiniMax query error: ${response.status} ${error}`)
  }
  return response.json()
}

// ─── Step 3: Retrieve file download URL ──────────────────────────────────────

export interface MiniMaxFileResponse {
  file: {
    file_id: string
    filename: string
    purpose: string
    download_url: string  // direct video URL — valid ~9 hours; store in R2/S3 for permanence
    created_at: number
    bytes: number
  }
}

export async function getVideoFileUrl(fileId: string): Promise<string> {
  const response = await fetch(
    `${BASE_URL()}/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
    { headers: authHeaders() }
  )
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MiniMax file retrieve error: ${response.status} ${error}`)
  }
  const data: MiniMaxFileResponse = await response.json()
  return data.file.download_url
}
