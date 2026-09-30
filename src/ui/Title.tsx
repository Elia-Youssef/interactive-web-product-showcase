// The product title: the brand on line 1, the model on line 2 in the
// accent red with its closing period, which the brand style includes in
// the accent. The period is presentational and never part of
// the model data, so it stays aria-hidden and the accessible text is the
// model name alone.

import styles from './Title.module.css'

export type TitleProps = {
  brand: string
  model: string
}

export function Title({ brand, model }: TitleProps) {
  return (
    <h1 className={styles.title}>
      <span className={styles.line}>{brand}</span>
      <span className={styles.line}>
        <span className={styles.accent}>
          {model}
          <span aria-hidden="true">.</span>
        </span>
      </span>
    </h1>
  )
}
