import { ambientMotion } from '@lib/motion/ambientMotion'
import { raPolygon, raViewBox } from './raGeometry'
import styles from './RaMark.module.css'

export function RaMark() {
  return (
    <span
      className={styles.mark}
      aria-hidden="true"
      {...{ [ambientMotion.attribute]: ambientMotion.value }}
    >
      <span className={styles.ring} data-ra-ring="white" />
      <span className={styles.glow}>
        <span className={styles.sweep} data-ra-sweep="">
          <span className={styles.ring} data-ra-ring="red" />
        </span>
      </span>
      <svg className={styles.glyph} viewBox={raViewBox} aria-hidden="true" focusable="false">
        <polygon className={styles.polygon} points={raPolygon} />
      </svg>
    </span>
  )
}
