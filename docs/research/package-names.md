# Package name selection

Checked on 2026-10-19 against the public npm registry with `npm view`, without authentication or publication. The complete responses and exit codes are in [registry evidence](evidence/npm-view-2026-10-19.json).

| Candidate          | Registry result               | Assessment                                                                              |
| ------------------ | ----------------------------- | --------------------------------------------------------------------------------------- |
| `svelte-imgkit`    | E404, no public package found | Short, but easy to confuse with ImageKit, a provider we intend to support               |
| `imgkit-svelte`    | E404, no public package found | Same ambiguity, less natural ordering                                                   |
| `svelte-imagekit`  | E404, no public package found | Readable, strongest implication of an official ImageKit integration                     |
| `svelte-imageway`  | E404, no public package found | Selected: readable and suggests multiple image delivery paths without favoring a vendor |
| `svelte-pixelflow` | E404, no public package found | Memorable, less explicit about images and delivery                                      |

The query requested `version`, `dist-tags`, `engines`, `peerDependencies`, `repository`, `time.modified`, and `deprecated` in JSON. Each name returned a structured registry E404 rather than a network timeout.

An absent registry entry is evidence of public absence at this time, not a guarantee that npm will accept the name, a trademark clearance, or ownership. Recheck immediately before publication. No scoped package is selected because no npm organization ownership has been supplied.

The public package is planned as `svelte-imageway`, including its `./edge` export. `packages/edge` will hold the deployable service workspace and stay private initially; this avoids a second public name or an invented organization scope.
