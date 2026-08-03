import type { WebGitGraphElement } from "./web-component";

/**
 * React JSX support for `<web-git-graph>`.
 *
 * Importing this module augments `React.JSX.IntrinsicElements` so that the
 * element can be rendered in TSX without a host-side ambient declaration:
 *
 * ```tsx
 * import "@web-git-graph/web/jsx"; // once, alongside the component import
 * <web-git-graph theme="dark" />
 * ```
 *
 * The presentation attributes (`theme`, `density`, `columns`, `date-format`,
 * `date-type`, `avatars`) are typed as React attributes so they can be set
 * directly in JSX. Complex values — the `provider`, `data` and `refs`
 * properties — are assigned as JavaScript properties, exactly as with the
 * DOM API, because React cannot pass Web Component properties through
 * attributes.
 */
export interface WebGitGraphJSXAttributes {
  theme?: string;
  density?: "comfortable" | "compact";
  columns?: string;
  "date-format"?: "datetime" | "date" | "relative";
  "date-type"?: "committed" | "authored";
  avatars?: boolean;
}

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "web-git-graph": React.DetailedHTMLProps<
          React.HTMLAttributes<WebGitGraphElement> & WebGitGraphJSXAttributes,
          WebGitGraphElement
        >;
      }
    }
  }
}

export type { WebGitGraphElement };
