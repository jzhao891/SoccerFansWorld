# Backlogs

- **Check-in trust model (Option A — voting with decay):** Replace the current last-write-wins check-in with an aggregated voting system. Store individual check-ins as timestamped votes in a `check_ins` subcollection under each venue. Compute `crowd_index` and `sound` from votes within a rolling time window (e.g. last 30 min), weighted so recent votes count more and old votes expire. The `live_statuses` doc becomes a computed summary rather than a direct user write. Requires either Firebase Cloud Functions for server-side aggregation or client-side recomputation on each check-in.

- **Event title editing via trust model:** Allow users to suggest edits to a venue's `event_title` from the drawer. Treat suggestions as votes — the most-voted title within a time window wins. Same voting-with-decay algorithm as the check-in trust model above. Guards against a single user setting a misleading event title.

- **Amenities editing via trust model:** Allow users to add or remove amenities from the drawer. Treat each amenity toggle as a vote — an amenity appears if a majority of recent votes include it. Same voting-with-decay algorithm. Prevents one user from cluttering or clearing the amenities list.
