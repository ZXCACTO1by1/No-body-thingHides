# Verification status for 1.0.0

This page separates evidence types so that a green check is not mistaken for universal live coverage.

| Area | Status | Meaning |
|---|---|---|
| Public client tests | Automated PASS | Five synthetic tests cover locale parity, client build boundaries, contract invariants, rebuild behavior and links. |
| Public client build | Automated PASS | `python scripts/build_client.py` produces the three expected client assets. |
| JavaScript syntax | Automated PASS | `node --check client/app.js` completes without syntax errors. |
| Main source gate | Observed in project receipt | The integrated source receipt records Ruff, format, mypy and full pytest results. |
| Installed release checks | Observed in project receipt | The release receipt records 15 installed checks with no skips in that run. |
| Owner's second-PC smoke | User observation | The owner reports that the portable release worked on a second Windows PC; no independent receipt is included here. |
| Fresh-OS acceptance | UNVERIFIED | No clean-room, instrumented fresh-OS receipt is published in this repository. |
| Full live provider coverage | UNVERIFIED | Provider access, rate limits and public availability vary over time. |
| Common-human attribution | Not a product claim | Presence and published links are not ownership proof. |

Run the public checks from the repository root:

```text
python scripts/build_client.py
python -m unittest discover -s tests
node --check client/app.js
```
