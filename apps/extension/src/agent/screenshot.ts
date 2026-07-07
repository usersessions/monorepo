/**
 * Screenshot capture for perception — MV3 service-worker safe.
 * No DOM Image/canvas here: OffscreenCanvas + createImageBitmap only.
 * Output is a JPEG data URL resized to maxWidth (default 800px, quality 0.7)
 * to keep the planning payload under control.
 */
export async function captureCompressed(windowId: number, maxWidth = 800): Promise<string | undefined> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
    const blob = await (await fetch(dataUrl)).blob()
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, maxWidth / bmp.width)
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * scale)), Math.max(1, Math.round(bmp.height * scale)))
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 })
    const buf = new Uint8Array(await out.arrayBuffer())
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK))
    return `data:image/jpeg;base64,${btoa(bin)}`
  } catch {
    return undefined // screenshots are optional planner context, never a blocker
  }
}
