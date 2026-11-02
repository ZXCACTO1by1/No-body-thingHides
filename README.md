# No[body]thingHides

No[body]thingHides finds public accounts from usernames and brings the results
together with source evidence. Enter a nickname once, choose a search scope, and
review accounts in separate sections for Telegram, GitHub and other services.

![Service-grouped results with synthetic example accounts](docs/images/results.en.png)

The application runs locally. Its main workflow combines account checks, similar
spellings, supported profile extraction and public profile links. Quick focuses
on popular services; Deep uses the full eligible catalogue. Both modes use the
same applicable search stages. You can stop a search, keep its saved progress and
continue later.

## Get started

The initial distribution targets Windows 11 x64. Download the archive attached to
version 1.0.0 on this repository's Releases page, extract the complete folder and
run `Start.cmd`. No separate Python installation or subscription is required.
Choose English or Russian from the language selector.

See [Quick start](docs/quick-start.md) or [Инструкция на русском](docs/ru/quick-start.md).

## Read results

Account cards include a profile address, how it was discovered and supporting
evidence references. Similar usernames and published links remain distinguishable.
Source failures and unverified leads have their own views. A matching username
does not establish that two accounts belong to the same person.

Export a readable report, text report or complete JSON data from Results.
[Result interpretation](docs/results.md) explains the states and evidence.
[Provider configuration](docs/credentials.md) explains the optional official APIs,
hidden-input credential commands and remaining Telegram transport limitations.

## Version 1.0.0

This is the first public release. Bugs and changes in supported services may
affect results. Further releases will improve reliability and coverage. A source
catalogue entry does not guarantee that the service is currently reachable or
that every account can be recovered.

## Source and license

This repository contains the client, versioned contracts, synthetic client tests
and user documentation. The original engine is distributed as a compiled binary.
The public source builds the client; it does not rebuild the private engine.

The application is free to use under its [original-material license](LICENSE).
Third-party components retain their own rights; see [NOTICE](NOTICE.md).
[Client build](docs/build-client.md) describes the boundary and workflow.

[Privacy](docs/privacy.md) · [FAQ](docs/faq.md) · [CLI](docs/cli.md) ·
[Local API](docs/api.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)
