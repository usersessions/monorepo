import { CapturePanel } from './CapturePanel'

import './style.css'

/** Popup — pivoted to product capture for video generation. */
function Popup() {
  return (
    <div style={{ width: 340, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: 12 }}>
        <strong>usersessions</strong>
        <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 12 }}>product → video</span>
      </header>
      <CapturePanel />
    </div>
  )
}

export default Popup
