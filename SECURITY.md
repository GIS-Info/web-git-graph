# Security

## Supported versions

Security fixes are provided for the latest published minor release.

## Reporting

Please report vulnerabilities privately through GitHub Security Advisories for
`GIS-Info/web-git-graph`. Do not include repository contents, credentials, or
private patches in a public issue.

## Node backend trust boundary

The bundled backend is intentionally read-only, but it exposes repository
history and source patches. Deploy it behind your existing authentication and
authorization.

- Register repositories server-side with opaque IDs.
- Configure `allowedRoots`.
- Do not derive a repository path directly from a URL.
- Keep CORS disabled unless the allowed origin is explicit.
- Use the `authorize` hook for every request.
- Use a shared `SnapshotStore` in multi-instance deployments.
- Keep the Git executable and this package patched.

The backend never invokes a shell and rejects arbitrary Git revision
expressions, but host-level access policy remains the application's
responsibility.
