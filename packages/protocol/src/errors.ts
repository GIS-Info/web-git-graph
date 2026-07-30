export type GitGraphErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "repository_not_found"
  | "revision_not_found"
  | "snapshot_expired"
  | "git_unavailable"
  | "output_limit"
  | "unsupported"
  | "rate_limited"
  | "internal_error";

export interface GitGraphProtocolErrorBody {
  error: {
    code: GitGraphErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export class GitGraphProtocolError extends Error {
  readonly code: GitGraphErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: GitGraphErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "GitGraphProtocolError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }

  toJSON(): GitGraphProtocolErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        ...(this.details ? { details: this.details } : {})
      }
    };
  }
}
