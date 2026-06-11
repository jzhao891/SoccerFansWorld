# Map Feature Design Decisions

- **FanZone visibility rule in `useMergedPlaces`:** A FanZone with a non-null `google_place_id` that was not returned by the Google Places API is silently skipped — not shown as `source: 'custom'`. Only FanZones with `google_place_id: null` are shown as custom. Rationale: a non-null `google_place_id` means the venue exists in Google but was deprioritized by Google Places API because the user hasn't zoomed in close enough to the center. Showing it as `custom` would be 
misleading and cause the same pin to flicker between `merged` and `custom` depending on zoom level. It will appear correctly as `merged` once the user zooms in and Places returns it.
