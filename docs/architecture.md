# Application overview

The local browser client presents forms, progress and saved results. The compiled
core selects admitted workflows, coordinates source adapters and persists jobs,
evidence and reports. SQLite stores investigation records. Report snapshots give
the client bounded, versioned pages without reconstructing trust from raw HTML.

Native source checking, original Maigret and SOCID extraction remain behind adapter
contracts. Evidence retains its source, time and content reference. Source gaps,
unverified leads, confirmed presence and subject attribution are distinct states.
Grouping organizes established accounts by service; it does not merge people.

External runtime libraries are separate, with their own notices and required
source material. The public client can be inspected and modified independently
of the original compiled core. This overview describes component responsibilities;
the original engine implementation is not part of the public source delivery.

There is no required hosted backend. Optional analysis only sends selected data
after the user reviews and confirms its destination. See [Privacy](privacy.md).
