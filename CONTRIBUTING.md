# Contributing

Thanks for your interest in **Bila UiTM Cuti**.

## Transparency, not full open source

This repository is **public for transparency** — you can read the code, see how the app works, and learn from it. It is **not** run like a community-owned open source project where anyone can drive the roadmap or merge changes freely.

- **Maintained by** [shahrulestar](https://github.com/shahrulestar)
- **Source is visible** under the [MIT License](LICENSE)
- **Direction and releases** are decided by the maintainer
- **External pull requests** are reviewed case by case and may not be merged

If you are looking for a project to co-maintain or fork actively, please understand that scope is intentionally limited here.

## Ways to help

### Report a bug or bad data

1. Check [bilauitmcuti.com](https://bilauitmcuti.com) on the latest deployment.
2. Open a **Bug report** issue with steps to reproduce, expected vs actual behavior, and browser/device if relevant.
3. For calendar date errors, mention the **activity or semester** and the **source** you compared against (e.g. official UiTM PDF).

### Suggest an improvement

Open a **Feature request** issue. Describe the problem for students, not only the solution you want. Feature requests are appreciated but **not guaranteed** to be implemented.

### Send feedback

For general comments, the in-app form is often faster:

**[bilauitmcuti.com/feedback](https://bilauitmcuti.com/feedback)**

You can also use the **General feedback** issue template on GitHub.

### Support the project

If the app saves you time, consider sponsoring ongoing work:

- [GitHub Sponsors — shahrulestar](https://github.com/sponsors/shahrulestar)
- [shahrulestar.com/sponsor](https://shahrulestar.com/sponsor)

## Pull requests

Pull requests are **welcome but optional**. Before spending time on code:

1. Open an issue or comment on an existing one so the change aligns with maintainer intent.
2. Keep the diff **small and focused** — one concern per PR.
3. Run locally before opening:

   ```bash
   pnpm install
   pnpm lint
   pnpm typecheck
   pnpm run build:pages
   ```

4. Use the pull request template and fill in every section.

The maintainer may close, rewrite, or defer PRs that are out of scope, too large, or duplicate ongoing work. **No response is not a rejection** — maintenance is done in spare time.

## Development setup

See [AGENTS.md](AGENTS.md) for environment variables, Cloudflare Pages constraints, and common commands.

## Code of conduct

By participating, you agree to abide by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
