import { chromium, expect, test } from '@playwright/test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DESKTOP, PHONE, endMonth, month, openGame } from './helpers'

const FALLBACK = '/opt/pw-browsers/chromium'
const launchArgs = ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const BASE = `http://localhost:${Number(process.env.PW_PORT ?? 5391)}/liangshan-108/`

for (const [name, vp, touch] of [['desktop', DESKTOP, false], ['phone', PHONE, true]] as const) {
  test(`autosave, close the browser, reopen and Continue to the same month (${name})`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ls108-profile-'))
    const opts = { viewport: vp, hasTouch: touch, isMobile: touch, ...(existsSync(FALLBACK) ? { executablePath: FALLBACK } : {}), args: launchArgs }
    try {
      let ctx = await chromium.launchPersistentContext(dir, opts)
      let page = ctx.pages()[0] ?? (await ctx.newPage())
      await page.goto(BASE)
      await page.evaluate(() => localStorage.setItem('ls108-settings', JSON.stringify({ speed: 'instant', showAiBattles: false })))
      await page.reload()
      await expect(page.getByTestId('continue')).toHaveCount(0)
      await page.getByTestId('new-game').click()
      await page.locator('summary').click()
      await page.getByTestId('seed').fill('11')
      await page.getByTestId('begin').click()
      await page.getByTestId('briefing-go').click()
      await page.getByTestId('game').waitFor()
      await endMonth(page)
      await endMonth(page)
      const m = await month(page)
      expect(m).toBe('Mar 1101')
      const saved = await page.evaluate(() => localStorage.getItem('ls108-save'))
      expect(saved).toContain('liangshan-108-save')
      await ctx.close()

      ctx = await chromium.launchPersistentContext(dir, opts)
      page = ctx.pages()[0] ?? (await ctx.newPage())
      await page.goto(BASE)
      const note = page.getByTestId('continue-note')
      await expect(note).toContainText('Mar 1101')
      await expect(note).toContainText('Song Jiang')
      await page.getByTestId('continue').click()
      await page.getByTestId('game').waitFor()
      expect(await month(page)).toBe('Mar 1101')
      // the whole log since the start survives the round trip (C8)
      if (touch) await page.getByTestId('sheet-handle').click()
      await page.getByTestId('tab-log').click()
      expect(Number(await page.getByTestId('log-count').innerText())).toBeGreaterThan(5)
      // play on after Continue
      await endMonth(page)
      expect(await month(page)).toBe('Apr 1101')

      // a new game asks once before it replaces the save
      await page.getByTestId('menu-title').click()
      await page.getByTestId('new-game').click()
      await page.getByTestId('begin').click()
      await expect(page.getByTestId('replace-save')).toBeVisible()
      await page.getByRole('button', { name: 'Keep it' }).click()
      await expect(page.getByTestId('briefing')).toHaveCount(0)

      // a corrupt save says why and offers to discard it
      await page.evaluate(() => localStorage.setItem('ls108-save', '{"format":"liangshan-108-save","version":1,"oops":'))
      await page.goto(BASE)
      await expect(page.getByTestId('save-problem')).toContainText('cannot be opened')
      await expect(page.getByTestId('continue')).toHaveCount(0)
      await page.getByTestId('discard-corrupt').click()
      await expect(page.getByTestId('save-problem')).toHaveCount(0)
      await ctx.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}

test.describe('rule 24: a long press never selects text (phone)', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true })
  test('no selection, callout or highlight', async ({ page }) => {
    await openGame(page)
    const style = await page.evaluate(() => { const s = getComputedStyle(document.body); return { sel: s.userSelect, callout: (s as unknown as Record<string, string>)['webkitTouchCallout'], tap: s.getPropertyValue('-webkit-tap-highlight-color') } })
    expect(style.sel).toBe('none')
    expect(style.tap).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    const hud = page.getByTestId('hud-renown')
    await hud.click({ clickCount: 3 })
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('')
    const prevented = await page.evaluate(() => {
      const e = new Event('selectstart', { cancelable: true, bubbles: true })
      document.querySelector('[data-testid=hud]')!.dispatchEvent(e)
      const c = new Event('contextmenu', { cancelable: true, bubbles: true })
      document.querySelector('[data-testid=hud]')!.dispatchEvent(c)
      return [e.defaultPrevented, c.defaultPrevented]
    })
    expect(prevented).toEqual([true, true])
    // inputs stay selectable
    await page.getByTestId('tab-heroes').click({ force: true }).catch(() => undefined)
    const sel = await page.evaluate(() => { const i = document.createElement('input'); document.body.appendChild(i); const s = getComputedStyle(i).userSelect; i.remove(); return s })
    expect(['text', 'auto']).toContain(sel)
  })
})
