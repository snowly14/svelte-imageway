# svelte-imageway

One image model for Svelte 5: local builds, managed image providers, a self-hosted service, and build publication.

**Status: Phase 0 research complete; M1 awaits approval. There is no installable implementation or published package yet.** The name was absent from the public npm registry on 19 October 2026; this does not reserve it.

Imageway aims to keep `<Image>` and `<Picture>` usage independent of the configured provider. It supplies software integrations, not an included global CDN. A CDN, object store, and any paid image service remain separate infrastructure.

## Review the proposal

- [Milestones and acceptance gates](docs/planning/milestones.md)
- [Architecture ADR](docs/adr/0001-architecture.md)
- [URL contract ADR](docs/adr/0002-url-contract.md)
- [Draft URL specification](docs/spec/url-contract.md)
- [Versions and compatibility](docs/research/versions-and-compatibility.md)
- [Competitive analysis](docs/research/competitive-analysis.md)
- [Platform capabilities and costs](docs/research/platforms-and-costs.md)
- [Package name research](docs/research/package-names.md)
- [Current report and requirements checklist](REPORT.md)
- [Original mission](docs/planning/original-brief.md)

## Proposed developer experience

The target is an installation, one Vite plugin entry, and an accessible image component. This is a design target, not a working quickstart. A verified quickstart will replace this section after M3/M4.

Local image imports should need no mandatory configuration. Remote optimization requires an explicit origin allowlist. CDN credentials, deployment, and billing enrollment are never automatic.

## Development

The workspace will use Bun, strict TypeScript, Svelte 5, and SvelteKit 3. Versions are recorded with registry evidence. Installation, build, lint, and test scripts will be introduced and executed in M1; no package manifest is present in this documentation-only phase.

## License

MIT. See [LICENSE](LICENSE).
