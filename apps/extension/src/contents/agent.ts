import type { PlasmoCSConfig } from 'plasmo'
import type { AgentAction } from '@usersessions/shared'

import { executeAction } from '../agent/actuator'
import { perceivePage } from '../agent/perception'

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
}

/**
 * Agent content-script entry: PERCEIVE and ACT run in the page; orchestration
 * stays in the background worker. VERIFY uses MutationObserver idle detection.
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'AGENT_PERCEIVE') {
    sendResponse(
      perceivePage({
        sessionId: String(msg.sessionId ?? 'none'),
        stepIndex: Number(msg.stepIndex ?? 0),
        platformId: String(msg.platformId ?? 'unknown'),
      })
    )
    return true
  }
  if (msg?.type === 'AGENT_EXECUTE') {
    void executeAction(msg.action as AgentAction, Boolean(msg.simulated))
      .then((success) => sendResponse({ success }))
      .catch(() => sendResponse({ success: false }))
    return true
  }
  if (msg?.type === 'AGENT_WAIT_STABLE') {
    void waitForDOMStability(Number(msg.maxMs ?? 8_000)).then(() => sendResponse({ stable: true }))
    return true
  }
})

/** Resolves when the DOM has been quiet for 500ms, or after maxMs regardless. */
function waitForDOMStability(maxMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      observer.disconnect()
      clearTimeout(hardStop)
      clearTimeout(idleTimer)
      resolve()
    }
    const observer = new MutationObserver(() => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(done, 500)
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    let idleTimer = setTimeout(done, 500)
    const hardStop = setTimeout(done, maxMs)
  })
}
