import styles from './RendererAlert.module.css'

// The typed error state of the stage: one alert holding the failure reason.
// Every failure path renders it, so a broken setup is visible, not silent.
export function RendererAlert({ reason }: { readonly reason: string }) {
  return (
    <p className={styles.alert} role="alert" data-testid="renderer-alert">
      {reason}
    </p>
  )
}
