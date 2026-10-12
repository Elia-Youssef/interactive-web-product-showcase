import { readChromeObstacles, type ChromeGeometryRoot } from '@lib/hotspots/chromeGeometry'
import type { StageRect } from '@lib/hotspots/markerBox'
import type { StageBox } from '@lib/hotspots/projection'

// One snapshot for every placement in a stage pass. A chrome mount, resize
// or stage-size change retires it. A steady frame reads no DOM or styles.
export class StageGeometry {
  private chrome: ChromeGeometryRoot | null = null
  private boxes: readonly StageRect[] = []
  private dirty = true
  private width = Number.NaN
  private height = Number.NaN
  private readonly listeners = new Set<() => void>()

  setChrome(chrome: ChromeGeometryRoot | null): void {
    this.chrome = chrome
    this.changed()
  }

  changed(): void {
    this.dirty = true
    for (const listener of this.listeners) {
      listener()
    }
  }

  read(stage?: StageBox): readonly StageRect[] {
    if (stage !== undefined && (stage.width !== this.width || stage.height !== this.height)) {
      this.width = stage.width
      this.height = stage.height
      this.dirty = true
    }
    if (this.dirty) {
      this.boxes = readChromeObstacles(this.chrome)
      this.dirty = false
    }
    return this.boxes
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
