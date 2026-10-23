/** The classifier (and its fallback) declined. The cluster is dismissed, not retried. */
export class ClassifierRefusal extends Error {}

/** Rate limit / outage / truncated reply. The cluster stays pending and is retried next scan. */
export class ClassifierUnavailable extends Error {}
