import { isAbsolute } from "node:path";

/**
 * Accepts only repository-relative paths as emitted by the Git backend.
 * Anything that could address a file outside the workspace folder — absolute
 * paths, Windows drive-relative paths, parent-directory segments or NUL
 * bytes — is rejected before it reaches the file system.
 */
export function isSafeRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.includes("\0") &&
    !isAbsolute(path) &&
    !/^[a-zA-Z]:/.test(path) &&
    !path.split(/[\\/]/).includes("..")
  );
}
