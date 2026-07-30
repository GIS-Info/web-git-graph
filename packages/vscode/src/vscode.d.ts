declare module "vscode" {
  export interface Disposable {
    dispose(): unknown;
  }

  export interface Uri {
    readonly fsPath: string;
    toString(skipEncoding?: boolean): string;
  }

  export namespace Uri {
    function joinPath(base: Uri, ...pathSegments: string[]): Uri;
  }

  export interface WorkspaceFolder {
    readonly name: string;
    readonly uri: Uri;
  }

  export interface TextDocument {}

  export interface Webview {
    html: string;
    cspSource: string;
    postMessage(message: unknown): Promise<boolean>;
    asWebviewUri(localResource: Uri): Uri;
    onDidReceiveMessage(
      listener: (event: unknown) => unknown,
      thisArgs?: unknown,
      disposables?: Disposable[]
    ): Disposable;
  }

  export interface WebviewPanel {
    readonly webview: Webview;
  }

  export interface ExtensionContext {
    readonly extensionUri: Uri;
    readonly subscriptions: Disposable[];
  }

  export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1
  }

  export namespace commands {
    function registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable;
  }

  export namespace workspace {
    const isTrusted: boolean;
    const workspaceFolders: readonly WorkspaceFolder[] | undefined;
    function openTextDocument(uri: Uri): Promise<TextDocument>;
  }

  export namespace window {
    function createWebviewPanel(
      viewType: string,
      title: string,
      showOptions: ViewColumn,
      options: {
        enableScripts: boolean;
        retainContextWhenHidden: boolean;
        localResourceRoots: readonly Uri[];
      }
    ): WebviewPanel;
    function showWarningMessage(message: string): Promise<string | undefined>;
    function showInformationMessage(message: string): Promise<string | undefined>;
    function showTextDocument(document: TextDocument): Promise<unknown>;
  }
}
