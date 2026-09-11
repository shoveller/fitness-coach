# anti-slop provenance

- Source repository: https://github.com/dmmulroy/anti-slop
- Installed from: `.agents/skills/install-anti-slop/assets/anti-slop/`
- Skill definition: `.agents/skills/install-anti-slop/SKILL.md`
- Skill lock hash: `4031728fbe75bdcad6ee3208fd52b5d66e167b056fefee1fa9758e9a6cb9c0c8`
- Exact upstream commit: unknown. The skill lock hash is not a commit ID.
- Pristine source snapshot: the bundled assets at the path above, as present at installation.
- Installed generic entry point: `tools/oxlint/anti-slop/index.ts`
- Optional Effect entry point (copied, not enabled): `tools/oxlint/anti-slop/effect/index.ts`
- Runtime dependencies: `oxlint` and `@oxlint/plugins`, both pinned to `1.82.0`.
- Local source changes: none; this provenance file is the only addition to the copied assets.
- Configuration: all generic rules and `oxc/no-accumulating-spread` enabled as errors in `.oxlintrc.json`; existing React rules retained.
- Nested third-party license and provenance: `vendor/eslint-stylistic/LICENSE` and `vendor/eslint-stylistic/UPSTREAM.md` retained.

For future updates, preserve this original bundled snapshot or recover it from repository history before using a three-way merge. Do not treat a later upstream HEAD or a replaced skill bundle as the original source.
