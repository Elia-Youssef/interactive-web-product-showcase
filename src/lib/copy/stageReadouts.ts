// The display formatting of the stage camera readouts: the last layer that
// rounds. The store holds exact values; these turn one exact value into the
// text its readout shows, with the ASCII-only shapes the design pins:
// `127 / 360` for the angle and `70%` for the zoom.

// The angle readout text of a normalized azimuth in degrees. The rounding
// wraps past 360, so a value that rounds to the full turn reads as its 0.
export function angleReadoutText(degrees: number): string {
  return `${Math.round(degrees) % 360} / 360`
}

// The zoom readout text of a zoom percentage.
export function zoomReadoutText(percent: number): string {
  return `${Math.round(percent)}%`
}

// The loading readout's text: the label and, while the figure is known, the
// whole percent it reads. An unknown figure keeps the label alone, so the
// indeterminate state never shows a number.
export function loadReadoutText(label: string, percent: number | null): string {
  return percent === null ? label : `${label} ${percent}%`
}
