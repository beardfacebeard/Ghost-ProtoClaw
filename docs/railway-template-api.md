# Railway Template API — Publish Workflow

This repo's `railway-template.json` describes the Ghost ProtoClaw stack. Railway stores a separate, frozen snapshot (the *serializedConfig*) behind the public deploy URL (`https://railway.com/deploy/S9YZU-`). **The repo file is not automatically pushed to Railway** — the snapshot has to be republished whenever `railway-template.json` changes.

## Current workflow: manual, via Template Editor

1. Edit `railway-template.json` in this repo and merge to `main`.
2. Open [the Template Editor](https://railway.com/workspace/templates/08fffc64-ac6a-4099-8afa-3bbd342b9d2b).
3. Apply the same change through the UI (Service → Variables / Settings / Source).
4. Click **Save** in the top-right. This fires `templateUpsertConfig` against the internal API.
5. Add a CHANGELOG entry.

A quick sanity check after Save: reload the editor page. If the change persists, the snapshot is updated. Anyone clicking the Deploy button from that point forward gets the new version.

## Why we don't have a CI auto-sync yet

Railway's publicly documented API (`https://backboard.railway.com/graphql/v2`) has `templatePublish` (meta only: description, readme, image), `templateGenerate` (snapshot an existing demo project into a template), `templateDeployV2`, `templateClone`, `templateUnpublish` — **but no mutation that updates the `serializedConfig` of an existing V2 template**.

The Template Editor UI uses an *internal* endpoint, `https://backboard.railway.com/graphql/internal`, with this mutation:

```graphql
mutation templateUpsertConfig($id: String!, $input: TemplateUpsertConfigInput!) {
  templateUpsertConfig(id: $id, input: $input) {
    id
    code
  }
}
```

where `input` = `{ name, workspaceId, serializedConfig }`. The internal endpoint blocks GraphQL introspection in production, and it's unclear whether Railway API tokens (as opposed to browser session cookies) are accepted there.

### Options if we want to automate later

- **Test API-token auth against `/graphql/internal`.** If it works, write `scripts/publish-railway-template.mjs` that transforms `railway-template.json` into the serializedConfig shape and POSTs the mutation. Downside: internal endpoints aren't contract-stable and Railway may change them without notice.
- **Use `templateGenerate`.** Maintain a real "demo project" on Railway that mirrors what we want deployers to get, then call `templateGenerate` on it. More moving parts but stays within the public API surface.
- **Browser bookmarklet.** One-liner the maintainer runs from the Template Editor page; reads `railway-template.json` from GitHub raw and calls `templateUpsertConfig` using the already-authenticated session. Simple but requires a human in the loop.

For now, the cost of "forget to republish" is low (a single browser click the next time we change the template), so we're accepting the manual flow.

## Reference: current Railway service IDs

The serializedConfig keys each service by an internal UUID. These are stable across edits to the same template:

| Service | Railway service UUID |
|---|---|
| Ghost-ProtoClaw | `19740b52-cd02-4c6a-8980-2abd6728ef29` |
| OpenClaw | (see Template Editor) |
| Hermes | (see Template Editor) |
| Codex | `326a6340-a73c-4a7a-96a3-a89ae02f6261` |
| Claude Code | (see Template Editor) |
| Postgres | `6f88ce83-c1c8-485c-98ac-c9a369ca7ff2` |

Template IDs:

- Template ID: `08fffc64-ac6a-4099-8afa-3bbd342b9d2b`
- Template code (public): `S9YZU-`
- Workspace ID: `955f0847-1f41-41cd-9c94-34be4a8a66c8`

## Drift check (future)

A read-only version of this check is cheap: the public `template(code: $code) { serializedConfig }` query works without auth and returns the currently-published snapshot. A CI job can compare that to what `railway-template.json` would produce and fail/warn on drift. That doesn't *fix* the drift — it just surfaces it.
