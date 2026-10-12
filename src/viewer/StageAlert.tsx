import styles from './StageAlert.module.css'

type StageAlertProps = {
  readonly reason: string
  // The problems a contract breach lists, one entry each, rendered as a
  // semantic list under the reason. A failure that says everything in its
  // reason carries none.
  readonly problems?: readonly string[]
  // The test id of the channel the alert reports: the renderer's by
  // default, the product's for a product failure. The role stays alert for
  // both.
  readonly testid?: string
}

// The typed error state of the stage: one alert holding the failure reason
// of the channel it reports for, and the problems the failure lists as a
// semantic list. Every failure path renders one, so a broken setup is
// visible, not silent.
export function StageAlert({ reason, problems, testid = 'renderer-alert' }: StageAlertProps) {
  return (
    <div className={styles.alert} role="alert" data-testid={testid}>
      <p className={styles.reason}>{reason}</p>
      {problems !== undefined && (
        <ul className={styles.problems}>
          {problems.map((problem, index) => (
            <li key={index}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
