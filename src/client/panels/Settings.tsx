import { useGame } from '../store/game'
import type { Speed } from '../store/game'
import { Stamp } from '../ui'

const SPEEDS: [Speed, string][] = [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast'], ['instant', 'Instant']]
export function Settings() {
  const { settings, setSettings } = useGame()
  return (
    <div className="settings" data-testid="settings">
      <h3>Presentation speed</h3>
      <p>How fast months and AI turns play out. Instant applies every result at once.</p>
      <div className="row">
        {SPEEDS.map(([k, l]) => <Stamp key={k} small kind={settings.speed === k ? 'confirm' : 'plain'} pressed={settings.speed === k} onClick={() => setSettings({ speed: k })} testId={`speed-${k}`}>{l}</Stamp>)}
      </div>
      <h3>Battles the AI fights without you</h3>
      <p>The engine settles these inside the month and keeps no move-by-move record, so the report can list their events or only their results.</p>
      <label className="check"><input type="checkbox" checked={settings.showAiBattles} onChange={(e) => setSettings({ showAiBattles: e.target.checked })} /> List their events in the month report</label>
    </div>
  )
}
