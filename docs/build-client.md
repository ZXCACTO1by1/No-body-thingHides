# Build the public client

The published source builds the interface assets and validates public contracts.
It does not compile the private engine. For an operating application, use the
matching official Windows core distribution and verify its published SHA256.
The client contract major version is 1; the initial application version is 1.0.0.

The client uses plain HTML, CSS and JavaScript. The build/check scripts use the
Python standard library and require Python 3.13 or newer only for source work:

```text
python scripts/build_client.py
python -m unittest discover -s tests
```

The build creates `dist/client/` with the three interface assets expected by the
core. In a separate copy of the official application, replace the corresponding
`release_ui.html`, `release_ui.css` and `release_ui.js` under
`osint_core/services/`. Keep the core's session binding and content security policy.
Open that copied application to review your client changes. Its original release
manifest no longer verifies modified assets; do not present it as an official
unchanged binary release.

Synthetic tests exercise contract shapes and client assets without personal cases
or a private token. Offline browser fixtures may mock the contract server. The
repository does not contain engine regression fixtures, compiler inputs or private
build credentials. Review the [contribution terms](../CONTRIBUTION_TERMS.md).
