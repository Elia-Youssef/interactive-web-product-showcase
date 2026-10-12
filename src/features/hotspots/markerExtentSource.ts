import type { MarkerExtent } from '@lib/hotspots/markerBox'
import type { StageBox } from '@lib/hotspots/projection'

// The marker extent the overlay pass places markers with, per stage size.
// The extent is the stylesheets' (the tokens on the document root), and a
// breakpoint that could switch a token is a viewport change, which reaches
// the canvas as a new stage size: the source reads the tokens again exactly
// when the size it is asked for changes, and otherwise hands back the
// extent it holds, so a frame at a steady size reads no style.
export class MarkerExtentSource {
  private width = Number.NaN
  private height = Number.NaN
  private extent: MarkerExtent | null = null

  constructor(private readonly read: () => MarkerExtent) {}

  for(stage: StageBox): MarkerExtent {
    if (this.extent === null || stage.width !== this.width || stage.height !== this.height) {
      this.extent = this.read()
      this.width = stage.width
      this.height = stage.height
    }
    return this.extent
  }
}
