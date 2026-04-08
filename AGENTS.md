# Repo Shape

- This repo has no root workspace manifest or shared task runner. Work inside the subproject you are changing: `frontlineapp/` for the web app, `contract/` for Solidity.
- `frontlineapp/` and `contract/` are independent; do not assume root-level `npm`, `bun`, or `forge` commands apply across both.
- Product and development context for the project lives in `docs/project-development.md`.

# frontlineapp

- Read `frontlineapp/AGENTS.md` before changing app code. It contains the only checked-in framework-specific instruction: this app is on Next.js `16.2.2`, and unfamiliar APIs should be checked against `node_modules/next/dist/docs/` rather than older Next knowledge.
- Package manager evidence is Bun (`frontlineapp/bun.lock`). Run app commands from `frontlineapp/`.
- Verified scripts are limited to `bun run dev`, `bun run build`, `bun run start`, and `bun run lint`.
- There is no dedicated `typecheck` or test script. Use `bun run build` as the full verification pass because Next build includes type checking for this app.
- App entrypoints are the App Router files in `frontlineapp/app/`: `layout.tsx`, `page.tsx`, and `globals.css`. There is no `src/` tree.
- Tailwind is configured with v4-style CSS imports in `app/globals.css` plus `postcss.config.mjs`; there is no `tailwind.config.*`. Do not add one unless the task requires it.
- TS path alias `@/*` maps to the `frontlineapp/` root.
- Generated or ignored app artifacts include `.next/` and `next-env.d.ts`; do not hand-edit them.

# contract

- `contract/` is a standalone Foundry project. Main directories are `src/`, `test/`, `script/`, and `lib/`.
- Verified local commands from checked-in docs/config are `forge fmt`, `forge build`, `forge test`, and `forge snapshot`, all run from `contract/`.
- CI order for Solidity changes is `forge fmt --check`, then `forge build --sizes`, then `forge test -vvv`.
- The checked-in deploy example is `forge script script/Counter.s.sol:CounterScript --rpc-url <url> --private-key <key>`.
- Generated contract artifacts live in `contract/out/` and `contract/cache/`; do not hand-edit them.
