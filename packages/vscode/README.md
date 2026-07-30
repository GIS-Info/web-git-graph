# @web-git-graph/vscode

VS Code host integration for Web Git Graph.

The Webview uses `@web-git-graph/web`, while the Extension Host calls
`@web-git-graph/node` in-process through a typed RPC interface. It does not
start a localhost HTTP server and does not perform Git mutations.
