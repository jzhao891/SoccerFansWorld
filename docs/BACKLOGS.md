# Backlogs

- **Check-in trust model (Option A — voting with decay):** Replace the current last-write-wins check-in with an aggregated voting system. Store individual check-ins as timestamped votes in a `check_ins` subcollection under each venue. Compute `crowd_index` and `sound` from votes within a rolling time window (e.g. last 30 min), weighted so recent votes count more and old votes expire. The `live_statuses` doc becomes a computed summary rather than a direct user write. Requires either Firebase Cloud Functions for server-side aggregation or client-side recomputation on each check-in.
