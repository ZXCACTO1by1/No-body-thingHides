# Local client contract

The browser client uses a versioned contract served by the installed core. It is
intended for a local session, not as a hosted public API. Open the application
page to establish a session. Mutating requests require the session's
`X-NBTH-Token`; never put that value in a URL or publish it.

| Route | Purpose |
|---|---|
| `/api/release/v1/catalog` | Admitted operations and localized typed fields. |
| `/api/release/v1/jobs` | Bounded safe progress summaries. |
| `/api/release/v1/jobs/{job_id}/output` | Explicit bounded tool text output. |
| `/api/easy/workspace` | Read-only local database readiness and record counts. |
| `/api/easy/selections` | Bounded named investigation/object/run/evidence/candidate selectors. |
| `/api/release/v1/results/{result_id}` | Result summary and first service page. |
| `/api/release/v1/results/{result_id}/services` | Next service index page. |
| `/api/release/v1/results/{result_id}/services/{service_id}/accounts` | Account cards for one service. |
| `/api/release/v1/results/{result_id}/leads` | Unverified follow-up records. |

Responses declare schema versions. Account pages contain at most 50 cards. Service
pages contain at most 100 headers. Use the returned cursor and snapshot together;
do not combine pages from different snapshots. Stable account keys do not establish
ownership. Unknown additive fields may be ignored; an incompatible major schema
requires a compatible client.

The contract schemas accompany the client repository. Errors contain stable codes,
permitted parameters and a request identifier rather than internal traces. The
explicit tool output view is distinct from background job polling and may contain
the user's investigation data despite convenience redaction.

Catalogue operations declare `needs_database`. Integer fields use kind `integer`
with their published bounds. Workspace states are `MISSING`, `READY`,
`NEEDS_UPDATE` and `UNAVAILABLE`; readiness checks do not create or migrate files.
Selectors include an investigation owner for related records. Safe validation
errors may name a permitted field; busy operations use `OPERATION_BUSY`.
Time and request limits and partial checks retain their actual job state and
continuation availability rather than being labelled as a program interruption.
