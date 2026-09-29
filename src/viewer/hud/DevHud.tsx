import { useEffect, useState } from 'react'
import { backendLabels } from '@lib/renderer/backendLabels'
import { frameStats } from '@lib/renderer/frameStats'
import type { FrameStats } from '@lib/renderer/frameStats'
import { selectRendererBackend, useAppStore } from '@store/index'
import type { FrameClock } from '../FrameClock'
import { hudRefreshMs } from './config'
import styles from './DevHud.module.css'

// Display formatting lives here, never in the statistics: the math is exact.
function formatFps(fps: number): string {
  return fps.toFixed(1)
}

function formatTickMs(tickMs: number | null): string {
  return tickMs === null ? '-' : `${tickMs.toFixed(1)} ms`
}

type DevHudProps = {
  readonly clock: FrameClock
}

// The development HUD: backend, frames per second, CPU milliseconds per
// render tick. The stage mounts it only in dev builds, which keeps the
// module out of the production bundle. It samples the frame clock at a fixed
// display cadence and never touches the render loop: no invalidate, no
// frameloop change.
export function DevHud({ clock }: DevHudProps) {
  const backend = useAppStore(selectRendererBackend)
  const [stats, setStats] = useState<FrameStats>(() => frameStats([], performance.now()))

  useEffect(() => {
    const sample = () => setStats(clock.stats(performance.now()))
    sample()
    const interval = window.setInterval(sample, hudRefreshMs)
    return () => window.clearInterval(interval)
  }, [clock])

  return (
    <aside
      className={styles.hud}
      data-testid="dev-hud"
      data-backend={backend ?? ''}
      aria-label="Renderer performance"
    >
      <div className={styles.row}>
        <span className={styles.label}>Backend</span>
        <span className={styles.value} data-testid="hud-backend">
          {backend === null ? '-' : backendLabels[backend]}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>FPS</span>
        <span className={styles.value} data-testid="hud-fps">
          {formatFps(stats.fps)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Tick CPU</span>
        <span className={styles.value} data-testid="hud-tick-cpu">
          {formatTickMs(stats.meanTickMs)}
        </span>
      </div>
    </aside>
  )
}
