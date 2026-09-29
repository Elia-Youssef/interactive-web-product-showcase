// A mono label for values that arrive as text, such as the stage chrome's
// angle readout. It renders the string it is given and
// never formats numbers: formatting belongs to the caller.

import styles from './Readout.module.css'

export type ReadoutProps = {
  children: string
}

export function Readout({ children }: ReadoutProps) {
  return <span className={styles.readout}>{children}</span>
}
