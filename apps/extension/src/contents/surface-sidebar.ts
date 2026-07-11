import type { PlasmoCSConfig } from 'plasmo'

/**
 * "Distribute to Surfaces" floating sidebar (Feature C).
 * Injected on-demand by the background worker into a surface tab. Shows the AI-drafted,
 * EDITABLE copy, a Copy-to-Clipboard button, Mark-as-Submitted, and Take-Screenshot for
 * proof. This is ASSISTED distribution: the human posts it themselves in their own account.
 * Nothing is submitted automatically.
 */
export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
}

interface SurfacePanelData {
  surfaceId: string
  surfaceName: string
  copy: string
}

const PANEL_ID = 'usersessions-surface-panel'

function removePanel(): void {
  document.getElementById(PANEL_ID)?.remove()
}

function renderPanel(data: SurfacePanelData): void {
  removePanel()
  const host = document.createElement('div')
  host.id = PANEL_ID
  host.style.cssText =
    'position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;'
  const shadow = host.attachShadow({ mode: 'open' })

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .card { background:#0F0F1A; color:#F4F2ED; border:1px solid #232330; border-radius:8px; padding:16px; box-shadow:0 8px 32px rgba(0,0,0,0.5); }
      .row { display:flex; align-items:center; gap:8px; }
      h3 { margin:0; font-size:14px; font-weight:600; flex:1; }
      .mono { font-family:"SF Mono",Monaco,Consolas,monospace; font-size:11px; color:#A8A5A0; }
      textarea { width:100%; height:180px; margin:12px 0; background:#09090F; color:#F4F2ED; border:1px solid #232330; border-radius:4px; padding:8px; font-size:12px; line-height:1.5; resize:vertical; }
      button { border:none; border-radius:4px; padding:8px 12px; font-size:12px; font-weight:600; cursor:pointer; }
      .primary { background:#6366F1; color:#F4F2ED; }
      .ghost { background:transparent; color:#A8A5A0; border:1px solid #232330; }
      .green { color:#34D399; }
      .close { background:transparent; color:#6B6862; font-size:16px; padding:0 4px; }
      .actions { display:flex; gap:8px; flex-wrap:wrap; }
      .status { margin-top:8px; font-size:11px; }
    </style>
    <div class="card">
      <div class="row">
        <h3>Distribute to ${data.surfaceName.replace(/</g, '')}</h3>
        <button class="close" id="x" aria-label="Close">×</button>
      </div>
      <p class="mono">Edit this draft, then post it yourself in your own account.</p>
      <textarea id="copy">${data.copy.replace(/</g, '&lt;')}</textarea>
      <div class="actions">
        <button class="primary" id="copyBtn">Copy to clipboard</button>
        <button class="ghost" id="shotBtn">Take screenshot</button>
        <button class="ghost" id="doneBtn">Mark as submitted</button>
      </div>
      <p class="status mono" id="status"></p>
    </div>
  `

  document.documentElement.appendChild(host)

  const $ = (id: string) => shadow.getElementById(id)
  const status = $('status') as HTMLParagraphElement
  const textarea = $('copy') as HTMLTextAreaElement

  $('x')?.addEventListener('click', removePanel)

  $('copyBtn')?.addEventListener('click', () => {
    void navigator.clipboard.writeText(textarea.value).then(
      () => {
        status.textContent = 'Copied. Paste it into the form, review, and post.'
        status.className = 'status mono green'
      },
      () => {
        status.textContent = 'Clipboard blocked — select the text and copy manually.'
        status.className = 'status mono'
      }
    )
  })

  $('shotBtn')?.addEventListener('click', () => {
    status.textContent = 'Capturing…'
    status.className = 'status mono'
    void chrome.runtime
      .sendMessage({ type: 'SURFACE_SCREENSHOT', surfaceId: data.surfaceId })
      .then((res: { ok?: boolean }) => {
        status.textContent = res?.ok ? 'Screenshot saved as proof.' : 'Could not capture the screenshot.'
        status.className = res?.ok ? 'status mono green' : 'status mono'
      })
  })

  $('doneBtn')?.addEventListener('click', () => {
    status.textContent = 'Saving…'
    status.className = 'status mono'
    void chrome.runtime
      .sendMessage({ type: 'SURFACE_MARK_SUBMITTED', surfaceId: data.surfaceId })
      .then((res: { ok?: boolean }) => {
        if (res?.ok) {
          status.textContent = 'Marked as submitted. Monitoring will verify it stays live.'
          status.className = 'status mono green'
          setTimeout(removePanel, 2500)
        } else {
          status.textContent = 'Could not save — make sure the dashboard tab is signed in.'
          status.className = 'status mono'
        }
      })
  })
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'RENDER_SURFACE_PANEL' && msg.data) {
    renderPanel(msg.data as SurfacePanelData)
  }
  if (msg?.type === 'REMOVE_SURFACE_PANEL') removePanel()
})
