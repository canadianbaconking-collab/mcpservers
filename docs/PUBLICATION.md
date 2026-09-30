# GitHub publication evidence

Repository: [canadianbaconking-collab/mcpservers](https://github.com/canadianbaconking-collab/mcpservers). The owner created the empty public repository and authorized publication of the complete suite.

- Published implementation commit: [`8e2d2bcdf8d72dd8c5487a9db53655831a93cdbf`](https://github.com/canadianbaconking-collab/mcpservers/commit/8e2d2bcdf8d72dd8c5487a9db53655831a93cdbf).
- Source Git tree: `0668d4d03750d7b196d0ff5677bb04ed9574794c`.
- Exact match to local build commit `68d0ccf6cabbb43a0467376419faa7fe3db71d65`: **136 tracked files**, all paths, file modes and Git blob hashes verified against the remote recursive tree.
- Includes all twelve servers, 40 tools, shared packages, schemas, tests, documentation, pinned vendor sources, lockfile and CI workflow. Ignored dependencies, databases, temporary files and machine-specific configuration are excluded.

GitHub recorded the implementation commit at **2026-09-30 04:14:17 UTC**. Publication used the connected GitHub Git-data API with a non-forced branch update; no Git credentials were changed and no existing remote content was overwritten.

## Hosted verification

[Suite checks run 36667954217](https://github.com/canadianbaconking-collab/mcpservers/actions/runs/36667954217) completed successfully:

| Runner | Install | All checks including Python adapters |
| --- | --- | --- |
| [Ubuntu](https://github.com/canadianbaconking-collab/mcpservers/actions/runs/36667954217/job/109736584779) | Passed, frozen lockfile | Passed |
| [Windows](https://github.com/canadianbaconking-collab/mcpservers/actions/runs/36667954217/job/109736584953) | Passed, frozen lockfile | Passed |

The subsequent publication-record commit changes documentation only and uses `[skip ci]`; it does not alter the tested implementation, dependencies or workflow. The original local commit history remains on the local `local-build-v0.1` branch. The local `main` branch tracks GitHub's API-created history after exact commit/tree verification.

This publishes source to GitHub. It does not publish npm packages, expose an HTTP service or install the servers into a remote MCP host.
