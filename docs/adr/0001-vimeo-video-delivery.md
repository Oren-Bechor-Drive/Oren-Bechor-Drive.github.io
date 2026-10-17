# 1. Deliver course videos through Vimeo players

Date: 2026-10-17. Status: accepted by the owner.

## Context

The [recommendation](../recommendation.md#private-video-delivery) planned private Supabase Storage for videos, delivered through `/api/media/<id>` after session, entitlement and content-version checks. Supabase Free allows 50 MB per file and 1 GB in total. The supplied course footage is mostly 4K and already uploaded to a Vimeo account on the paid Starter plan. Downscaling it to fit the free quota would hurt readability, which the recommendation rules out.

## Decision

Course videos play in embedded Vimeo players. Images, diagrams and any file-based captions or transcripts keep the existing private-media path.

- `server/vimeo-media.mjs` reads a server-only registry from `VIMEO_MEDIA_ENTRIES`. It adds `video/vimeo` descriptors to the authorized paid section response. The player URL reaches a learner only with a section the gateway has already authorized.
- The reader renders an `iframe` limited by `frame-src https://player.vimeo.com`. The iframe sends an origin-only referrer so that Vimeo's domain-level privacy can identify the course site; the rest of the page keeps `no-referrer`.
- Each video must be hidden from Vimeo, embeddable only on the course domain, and not downloadable. These settings live in the Vimeo account, not in this repository.
- Vimeo IDs, hashes and account links stay out of this public repository.

## Consequences

- Vimeo handles encoding, adaptive streaming and storage. Learners do not request video bytes through the gateway.
- This boundary is weaker than self-hosting. The gateway cannot revoke a player URL already sent to an entitled learner, and a client that spoofs the course origin as its referrer can play a known video. Self-hosting had a similar limit: it could not revoke bytes already delivered or prevent screen capture.
- The paid Vimeo plan is the owner's cost and an exception to the no-paid-services hosting policy. Loss of that plan or a privacy-setting mistake exposes or breaks playback.
- Vimeo-hosted captions replace native `<track>` captions for these videos. Its automatic Hebrew captions need review before release. Transcripts for Vimeo videos are not implemented yet.
- Vimeo's player handles keyboard and screen-reader behavior. It still needs verification on physical devices.
