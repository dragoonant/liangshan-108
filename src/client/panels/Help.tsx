import { Footer } from '../ui'
import { clientQuery } from '../../engine'

export function HelpBody() {
  return (
    <div className="help" data-testid="help">
      <h3>The goal</h3>
      <p>You are a wronged hero in the marsh country of 1101. Win the Emperor's Edict by building Renown, then take the capital and capture Gao Qiu. If the deadline month arrives first, the court's patience ends and you lose. The deadline and your Edict pace are on screen at all times.</p>
      <h3>The month</h3>
      <p>Each month you give orders from your prefectures, then end the month with the stamp at the bottom. The rivals and the court move, the harvest and taxes come in, and a new month begins. A prefecture gives orders only while a hero who can command is in it: two for the chieftain, one for a sworn brother or a loyal hero (loyalty 60 or more).</p>
      <p>Every order opens a prompt that says what it decides, what it costs and its odds. Nothing is spent until you press CONFIRM. There is no undo.</p>
      <h3>Six things to watch</h3>
      <ul>
        <li><b>Food.</b> A prefecture with less than two months of food is warned in amber; with less than one, in red, and men desert.</li>
        <li><b>Support.</b> At 15 or less the people revolt next month.</li>
        <li><b>Loyalty.</b> Ordinary heroes who fall to 25 or less will leave. Sworn brothers never do.</li>
        <li><b>Renown.</b> Earned by justice, relief, beasts and bandits, battles and heroes. The ledger shows each source. {clientQuery.edictThreshold()} earns the Edict.</li>
        <li><b>Forecast.</b> Snowed-in passes and scheduled disasters are shown a month ahead.</li>
        <li><b>The court's campaigns.</b> The court announces a march one month before it arrives.</li>
      </ul>
      <h3>Brotherhood</h3>
      <p>Invite free heroes, persuade captives, then swear brotherhood with those whose loyalty is high enough and whose virtues match the chieftain's. Sworn brothers keep the prefecture they hold and stay for good.</p>
      <h3>Battles</h3>
      <p>Battles are fought on hexes, up to 20 days. Each day you move and act with each unit once, then end the day. Click a hex to move, attack or select; the hex under your cursor shows its unit with the odds. Fatigue lists its causes. If day 20 ends without a result the attackers withdraw. Auto-resolve lets the AI play your side.</p>
      <p>Camera: wheel zooms, right-drag rotates, middle-drag pans, left clicks. With a two-button mouse the left drag pans until you press the middle button once. On a phone: one finger pans, two fingers twist and pinch.</p>
      <h3>Saving</h3>
      <p>The game saves itself after every action in this browser, under one slot. The title screen's Continue names the game it reopens. A finished game clears its save. Saves do not travel between a local copy and the web page, because browsers keep them apart.</p>
      <Footer />
    </div>
  )
}
