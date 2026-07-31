---
project: tbench-unijack
title: UniJack (TBench.Solutions) — market & competitive brief
cluster: web
status: research — vendor claims, third-party-unverified
wiki: _(no wiki node yet — candidate for /wiki-ingest)_
hub: _(no hub entry yet — add one at ~/Claude/hub/tbench-unijack/)_
updated: 2026-07-25
---

# UniJack market brief (TBench.Solutions UG)

This directory is a **cwd anchor, not a code repo** — it is intentionally empty apart from
`.claude/`. 23 session transcripts have run here. The actual deliverable is a published artifact;
the durable state is in memory, not in files.

## What this is

Recurring scheduled task `unijack-work` ("continue the tasks in UniJack target customer") maintaining
a market & competitive brief on **UniJack**, a modular embedded test platform from TBench.Solutions UG
(Hamburg, 3-person, €300 capital). Origin question: *who is the target customer.*

## Where the state actually lives — read these first

| what | where |
|---|---|
| **Full brief state** (findings, open items, artifact URLs) | `~/.claude/projects/-Users-friday-Claude-code-Tbench/memory/unijack-market-brief.md` |
| Scheduled task definition | `~/.claude/scheduled-tasks/unijack-work/SKILL.md` |
| Deliverable | single-page HTML pitch deck, published artifact (URL in the memory file) |
| Side deliverables | design-directions A/B/C artifact (awaiting Michael's pick); GTM-redline artifact (response to the DXLab/Barry go-to-market doc) — both have their own URLs in the memory file |
| Pitch video assets (4.8 G, separate effort) | `~/unijack-pitch-video/` |

Scratchpads get cleared between sessions — to edit the deck, re-fetch its source via WebFetch of the
artifact URL and strip the frame-runtime wrapper. Update **in place** via the `url` param; do not mint
a new artifact.

## Status discipline for this project

Nearly everything known about UniJack is **vendor-stated**. There are **zero third-party benchmarks**
and no published latency/jitter figure. Infineon Gold certification, "boards built", and ISO 26262
proximity are all vendor claims — ISO 26262 attaches to TBench's *consulting*, not the product, and
Mercury is explicitly "future versions will be fully qualified" (= not now).

Carry that. Do not upgrade a vendor claim to a verified capability.

## Access notes

`tbenchsolutions.com` 403s `curl`/WebFetch and is policy-blocked in the in-app Browser pane — read it
via **claude-in-chrome**. TMview search API works (no captcha); DPMAregister/DEPATISnet are bot-blocked.

## Rules

`~/.claude/CLAUDE.md` applies. This is competitive research on a real company — keep claims sourced
and attributed, and keep the vendor/independent distinction visible in the deliverable.

<!-- research-record-pointer:start -->

## External research

Scans of Hugging Face and GitHub for work adjacent to this project are recorded at
`~/Claude/hub/research/by-project/tbench-unijack.md`. Read it before searching the web for a
library, model, or prior art — it may already be answered there, with the licence and
maintenance state checked.

Everything in that file is `{status: unverified}` — READMEs, model cards and vendor claims,
none of it run on this hardware. Treat it as leads, never as fact.

To check whether anything there has changed: `python3 ~/Claude/hub/research/bin/check_updates.py`

<!-- research-record-pointer:end -->
