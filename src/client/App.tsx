import { useEffect } from 'react'
import { useGame } from './store/game'
import { Title } from './screens/Title'
import { StartPicker } from './screens/StartPicker'
import { Game } from './screens/Game'
import { Modal } from './ui'
import { HelpBody } from './panels/Help'
import { Settings } from './panels/Settings'

export function App() {
  const screen = useGame((g) => g.screen)
  const { helpOpen, settingsOpen, set2 } = useGame()
  useEffect(() => {
    // KB rule 24: no selection, callout or context menu outside inputs (the CSS does the rest)
    const ok = (t: EventTarget | null): boolean => t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]')
    const sel = (e: Event): void => { if (!ok(e.target)) e.preventDefault() }
    document.addEventListener('selectstart', sel)
    document.addEventListener('contextmenu', sel)
    return () => { document.removeEventListener('selectstart', sel); document.removeEventListener('contextmenu', sel) }
  }, [])
  return (
    <>
      {screen === 'title' ? <Title /> : screen === 'start' ? <StartPicker /> : <Game />}
      {screen !== 'title' && helpOpen ? <Modal title="How to play" onClose={() => set2({ helpOpen: false })} wide><HelpBody /></Modal> : null}
      {screen !== 'title' && settingsOpen ? <Modal title="Settings" onClose={() => set2({ settingsOpen: false })}><Settings /></Modal> : null}
    </>
  )
}
