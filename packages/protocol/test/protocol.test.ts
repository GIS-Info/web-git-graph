import { describe, expect, it } from "vitest";
import {
  GIT_GRAPH_JSON_SCHEMAS,
  GIT_GRAPH_PROTOCOL_VERSION,
  GitGraphProtocolError
} from "../src";
import { GIT_GRAPH_CONTENT_TYPE, OPENAPI_DOCUMENT } from "../src/http";

describe("@web-git-graph/protocol", () => {
  it("serializes transport-neutral errors", () => {
    const error = new GitGraphProtocolError("snapshot_expired", "Refresh required.", {
      retryable: true,
      details: { cursor: "opaque" }
    });

    expect(error).not.toHaveProperty("status");
    expect(error.toJSON()).toEqual({
      error: {
        code: "snapshot_expired",
        message: "Refresh required.",
        retryable: true,
        details: { cursor: "opaque" }
      }
    });
  });

  it("publishes stable protocol and HTTP metadata", () => {
    expect(GIT_GRAPH_PROTOCOL_VERSION).toBe("1");
    expect(GIT_GRAPH_CONTENT_TYPE).toContain(".v1+json");
    expect(OPENAPI_DOCUMENT.paths["/v1/repositories/{id}/history"]).toBeDefined();
  });

  it("keeps revision schemas restricted to opaque revisions", () => {
    expect(JSON.stringify(GIT_GRAPH_JSON_SCHEMAS.revision)).not.toContain("selector");
    expect(JSON.stringify(GIT_GRAPH_JSON_SCHEMAS.revision)).not.toContain("HEAD~");
  });
});
