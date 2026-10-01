import styles from './StageAlert.module.css'

type StageAlertProps = {
  readonly reason: string
  // The test id of the channel the alert reports: the renderer's by
  // default, the product's for a product failure. The role stays alert for
  // both.
  readonly testid?: string
}

// The typed error state of the stage: one alert holding the failure reason
// of the channel it reports for. Every failure path renders one, so a
// broken setup is visible, not silent.
export function StageAlert({ reason, testid = 'renderer-alert' }: StageAlertProps) {
  return (
    <p className={styles.alert} role="alert" data-testid={testid}>
      {reason}
    </p>
  )
}
