# Reading results

Each service has its own section and account count. More than one Telegram handle
remains more than one account. Equal usernames on different services remain
separate. A profile card represents account presence supported by the source
contract and evidence; it does not identify its owner.

Exact username means the searched spelling matched. Similar username means an
alternative spelling was checked. Published link means a source declared a link
that was independently checked. A single established account may carry several
labels and evidence references.

| State | Interpretation |
|---|---|
| Found | The source supplied the required account evidence. |
| Not found | The checked source supplied a supported negative response. |
| Unknown | Available information did not establish presence or absence. |
| Blocked | The source restricted access. |
| Rate limited | The source asked requests to slow down or stop. |
| Not checked | Work remains pending or was not attempted. |
| Error | The check did not complete successfully. |

Unconfirmed checks retain work without enough account evidence. Their reason
distinguishes a provider refusal, missing configuration, rate limit, redirect,
unsupported contract and an inconclusive profile. A next-attempt time is shown
when a saved retry can become due. Filter these checks by reason; they remain
separate from confirmed account cards. Use All checks to see source gaps and
pending work. No accounts in a view does not establish that
the person has no accounts anywhere. Evidence references, timestamps and original
source text support review; a search is a snapshot of a changing service.

Readable and text exports organize accounts by service. Full JSON preserves the
machine report and evidence references. Review every export before sharing it:
search terms, links and source responses can identify people.

Continue retains the total physical request budget, including earlier segments.
Short cooldowns can continue automatically; longer waits remain saved. API quota
reservations are recorded separately and do not establish actual provider billing.
See [provider configuration](credentials.md) for the supported API dependencies.
