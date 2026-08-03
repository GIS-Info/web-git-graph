// Regression test for the React JSX augmentation in jsx.d.ts.
// Compiles under `pnpm --filter @web-git-graph/web typecheck` (react is a
// devDependency) and is never executed at runtime.
import "@web-git-graph/web/jsx";

export function App(): JSX.Element {
  return (
    <web-git-graph
      theme="dark"
      density="compact"
      columns="date,commit"
      date-format="relative"
      date-type="authored"
      avatars
      ref={(el) => {
        const node: HTMLElement | null = el;
        void node;
      }}
    />
  );
}

export const AppJsx = <web-git-graph theme="light" />;

// @ts-expect-error unknown attributes are rejected
export const Bad = <web-git-graph bogus="x" />;
