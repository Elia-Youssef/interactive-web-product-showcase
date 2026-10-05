// The stage chrome's angle readout: the live azimuth of the stage camera
// as `NNN / 360`. The slot sits empty while no product view is presented,
// so the corner carries nothing that could go stale.

import { normalizedAzimuthDegrees } from '@lib/camera/azimuth'
import { selectCameraReadout, useAppStore } from '@store/index'
import { Readout } from '@ui/index'
import { angleReadoutText } from '@lib/copy/stageReadouts'

export function StageAngleReadout() {
  const readout = useAppStore(selectCameraReadout)

  if (readout.kind !== 'live') {
    return null
  }
  return <Readout>{angleReadoutText(normalizedAzimuthDegrees(readout.azimuth))}</Readout>
}
