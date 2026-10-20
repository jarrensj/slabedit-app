This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## No personal information in the repo

Never commit personal information — email addresses, phone numbers, wallet addresses, or similar PII — anywhere: not in tracked files, commit messages, or PR titles/descriptions.

- When creating or updating `.env.example`, omit any value of a variable whose value is personal information (e.g. `EXPO_PUBLIC_SUPPORT_EMAIL`) entirely — do not include it with a placeholder, and never copy real values from other env files. Just leave the value empty in `.env.example`.
- If personal information is needed for the app to run, it belongs only in local untracked env files (`.env*.local`) or EAS environment variables.
- Anything in an `EXPO_PUBLIC_` variable is compiled into the app, and anyone who downloads it can read it. Never put secrets there.
- Before committing, scan the diff for anything matching an email, phone number, or wallet address and remove it first.

## Keep Terms of Service & Privacy Policy in sync

When a new feature changes what the app collects, stores, shares, or lets users do — e.g. new
personal data collected, third-party services or analytics added, payments, user-generated content,
tracking — update the Terms of Service and Privacy Policy to reflect it in the same PR. If those
pages don't exist in the repo yet or live elsewhere (e.g. on the website), flag the needed update in
the PR's Deployment Notes instead of silently shipping the feature.

The same changes usually also need:

- the App Store's App Privacy details and Google Play's Data safety form updated before the next
  release — flag them in Deployment Notes too;
- a clear permission message whenever a feature asks for a new permission (photos, camera, …), set
  through the module's config plugin in `app.json`.

## Commit & PR guidelines

- **One feature per PR — no coupling.** Each feature reviews, merges, and reverts independently. A
  change spanning two features is two PRs.
- **Follow-ups live in the code as `TODO` comments.** If a PR description notes a follow-up that is
  required or recommended (but out of scope for this PR), also leave a `TODO:` comment at the relevant
  spot in the code describing it, so it isn't forgotten while the PR stays one feature.
- **Each PR is complete, not half-plumbing** — its dependency or config change *and* the code/UI that
  uses it *and* a working path. No unused dependencies or config.
- **Chain PRs as necessary** — if someone can't review right away, chain off each other instead of
  waiting; otherwise make each PR off latest origin main.
- **Fill the PR template's Deployment Notes** — env vars needed? Does it need a new native build (EAS
  Build), or can it ship as an over-the-air update (EAS Update)?
- **Keep PRs reviewable** — small enough to read in one sitting.
- **Plain commit messages — no AI-attribution trailers.** Subject + body only. Never append any
  AI/assistant attribution to a commit.
- **Graduate to review, don't merge** — open each PR for review (`gh pr ready`) and stack dependents on
  its branch.
