# Code Quality & Senior Engineering Principles

## 1. YAGNI & Deletion Over Addition

- The best code is the code never written. Prohibit boilerplate and scaffolding for speculative features.
- Avoid single-implementation interfaces, single-product factories, and static value configuration wrappers.
- Three similar lines of code are better than a premature abstraction.

## 2. No Generic Lib/Utils Dump

- Prohibit creating root `src/lib/` or `src/utils/` folders.
- Co-locate logic inside domain feature modules (`src/modules/<feature>/`), route folders (`src/routes/<route>/-lib/`), or UI helpers (`src/components/ui/utils.ts`).

## 3. Strict Typing

- Enforce TypeScript strict mode without exceptions.
- Ban the `any` type; use explicit typesafe schemas, unions, or generics.
- Run `npm run typecheck` (`tsc --noEmit`) to verify type safety before committing.

## 4. Error Handling

- Validate inputs strictly at system boundaries (user input, search parameters, API request bodies).
- Trust internal invariants; do not litter code with defensive checks for impossible states.
