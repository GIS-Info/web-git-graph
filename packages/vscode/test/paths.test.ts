import { describe, expect, it } from "vitest";
import { isSafeRelativePath } from "../src/paths";

describe("isSafeRelativePath", () => {
  it("accepts repository-relative paths", () => {
    expect(isSafeRelativePath("README.md")).toBe(true);
    expect(isSafeRelativePath("src/deep/file.ts")).toBe(true);
    expect(isSafeRelativePath("with space/文件.txt")).toBe(true);
  });

  it("rejects paths that can escape the workspace folder", () => {
    expect(isSafeRelativePath("")).toBe(false);
    expect(isSafeRelativePath("/etc/passwd")).toBe(false);
    expect(isSafeRelativePath("C:\\Windows\\system32")).toBe(false);
    expect(isSafeRelativePath("C:file")).toBe(false);
    expect(isSafeRelativePath("../outside.txt")).toBe(false);
    expect(isSafeRelativePath("nested/../../outside.txt")).toBe(false);
    expect(isSafeRelativePath("nul\0byte")).toBe(false);
  });
});
