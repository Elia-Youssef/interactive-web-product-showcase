import type { CollectionError, CollectionProblem } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import styles from './CollectionErrorScreen.module.css'

// The typed error screen for a collection that failed to validate: one
// alert region that names every problem
// with its product and field path. Nothing here can throw again; the words
// are the problems themselves plus the one heading from the site copy.

function ProblemLine({ problem }: { problem: CollectionProblem }) {
  return (
    <>
      {problem.product === null ? null : <span className={styles.product}>{problem.product}</span>}
      {problem.path === null ? null : <span className={styles.path}>{problem.path}</span>}
      <span className={styles.message}>{problem.message}</span>
    </>
  )
}

export function CollectionErrorScreen({ error }: { error: CollectionError }) {
  return (
    <section role="alert" className={styles.screen}>
      <h1 className={styles.heading}>{siteCopy.collectionErrorHeading}</h1>
      <ul className={styles.problems}>
        {error.problems.map((problem, index) => (
          <li key={index} className={styles.problem}>
            <ProblemLine problem={problem} />
          </li>
        ))}
      </ul>
    </section>
  )
}
