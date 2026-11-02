# Limitations

No[body]thingHides is a local-first research tool, not an identity oracle. The following limits are part of the product contract.

## Coverage

- Service availability, robots rules, login walls, rate limits and provider API changes can change results without an application release.
- A catalogue entry does not guarantee that a service is reachable or that every account can be recovered.
- Telegram public preview parsing is included; native Telegram MTProto transport is not implemented or activated in 1.0.0.
- New provider APIs may have contracts and mocked tests without fresh live acceptance.

## Meaning of a result

- Presence is separate from attribution. A matching username, profile link or public identifier does not prove a common human owner.
- `UNKNOWN`, `BLOCKED`, `RATE_LIMITED`, `NOT_CHECKED` and `UNVERIFIED` are meaningful outcomes, not hidden failures.
- `NOT_FOUND` is only authoritative for the exact source contract and scope that produced it.
- Reports may contain public personal information. Review them before sharing.

## Platform and packaging

- The official portable release targets Windows 11 x64.
- The public repository builds the client and validates contracts; it does not rebuild the private compiled engine.
- The current release was checked on a second Windows PC by the owner, but that observation is not a reproducible fresh-OS receipt in this repository.

## Scope boundaries

Face/avatar research, phone-identifier research and broad population-level recall are future work, not 1.0.0 capabilities.
