import type { Page } from '@playwright/test'

export const PHONE = { width: 390, height: 844 }
export const DESKTOP = { width: 1440, height: 900 }

export async function openGame(page: Page, opts: { seed?: number; hero?: string; speed?: string; difficulty?: number } = {}): Promise<void> {
  await page.goto('./')
  await page.evaluate((speed) => localStorage.setItem('ls108-settings', JSON.stringify({ speed, showAiBattles: false })), opts.speed ?? 'instant')
  await page.reload()
  await page.getByTestId('new-game').click()
  if (opts.hero) await page.getByTestId(`start-${opts.hero}`).click()
  if (opts.difficulty) await page.getByTestId(`diff-${opts.difficulty}`).click()
  await page.locator('summary').click()
  await page.getByTestId('seed').fill(String(opts.seed ?? 7))
  await page.getByTestId('begin').click()
  await page.getByTestId('briefing-go').click()
  await page.getByTestId('game').waitFor()
}

export const month = async (page: Page): Promise<string> => (await page.getByTestId('hud-month').innerText()).trim()

/** Settle whatever the game is showing after a month ends: answer a decision, auto-resolve a battle, close a report. Returns when the strategic map is idle. */
export async function settle(page: Page): Promise<string[]> {
  const seen: string[] = []
  for (let i = 0; i < 12; i++) {
    if (await page.getByTestId('pending').isVisible().catch(() => false)) {
      seen.push('pending')
      const first = page.locator('[data-testid="pending"] .variant').first()
      await first.click()
      continue
    }
    if (await page.getByTestId('battle').isVisible().catch(() => false)) {
      seen.push('battle')
      await page.getByTestId('auto').click()
      await page.getByTestId('auto-yes').click()
      continue
    }
    if (await page.getByTestId('battle-report').isVisible().catch(() => false)) {
      seen.push('report')
      await page.getByTestId('report-close').click()
      continue
    }
    if (await page.getByTestId('result').isVisible().catch(() => false)) { seen.push('result'); return seen }
    if (await page.getByTestId('end-month').isVisible().catch(() => false)) return seen
    await page.waitForTimeout(150)
  }
  return seen
}

export async function endMonth(page: Page): Promise<string[]> {
  await page.getByTestId('end-month').click()
  return settle(page)
}

export const hook = async <T>(page: Page, fn: string): Promise<T> => page.evaluate(`(${fn})(window.__ls108)`) as Promise<T>

export async function tap(page: Page, x: number, y: number, touch: boolean): Promise<void> {
  if (touch) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}
