import * as vscode from 'vscode';
import { RailwayAPI, RailwayDeployment, DeploymentLog, RailwayService } from './railway-api';

export class LogViewerPanel {
    public static currentPanel: LogViewerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private resource: RailwayDeployment | any;
    private railwayAPI: RailwayAPI;
    private logType: 'deployment' | 'application';
    private autoRefreshInterval: NodeJS.Timeout | undefined;

    public static createOrShow(
        extensionUri: vscode.Uri,
        resource: RailwayDeployment | any,
        railwayAPI: RailwayAPI,
        logType: 'deployment' | 'application' = 'deployment'
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (LogViewerPanel.currentPanel) {
            LogViewerPanel.currentPanel._panel.reveal(column);
            LogViewerPanel.currentPanel.updateResource(resource, logType);
            return;
        }

        const title = logType === 'deployment' 
            ? `Railway Deployment Logs - ${resource.id ? resource.id.substring(0, 8) : 'Unknown'}`
            : `Railway Application Logs - ${resource.name || (resource.id ? resource.id.substring(0, 8) : 'Service')}`;

        const panel = vscode.window.createWebviewPanel(
            'railwayLogs',
            title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        LogViewerPanel.currentPanel = new LogViewerPanel(panel, extensionUri, resource, railwayAPI, logType);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        resource: RailwayDeployment | any,
        railwayAPI: RailwayAPI,
        logType: 'deployment' | 'application'
    ) {
        this._panel = panel;
        this.resource = resource;
        this.railwayAPI = railwayAPI;
        this.logType = logType;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'refresh':
                        await this.refreshLogs();
                        break;
                    case 'toggleAutoRefresh':
                        this.toggleAutoRefresh();
                        break;
                    case 'clearLogs':
                        this._panel.webview.postMessage({ command: 'clearLogs' });
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public async updateResource(resource: RailwayDeployment | any, logType: 'deployment' | 'application') {
        this.resource = resource;
        this.logType = logType;
        
        const title = logType === 'deployment' 
            ? `Railway Deployment Logs - ${resource.id ? resource.id.substring(0, 8) : 'Unknown'}`
            : `Railway Application Logs - ${resource.name || (resource.id ? resource.id.substring(0, 8) : 'Service')}`;
        
        this._panel.title = title;
        await this.refreshLogs();
    }

    private async refreshLogs() {
        let logs: DeploymentLog[] = [];
        
        if (this.logType === 'deployment') {
            logs = await this.railwayAPI.getDeploymentLogs(this.resource.id, 500);
        } else {
            // For application logs, we need the service ID and environment ID
            logs = await this.railwayAPI.getApplicationLogs(
                this.resource.id || this.resource.serviceId, 
                this.resource.environmentId,
                500
            );
        }
        
        this._panel.webview.postMessage({ 
            command: 'updateLogs', 
            logs: logs,
            logType: this.logType
        });
    }

    private toggleAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = undefined;
            this._panel.webview.postMessage({ command: 'autoRefreshStopped' });
        } else {
            this.autoRefreshInterval = setInterval(() => {
                this.refreshLogs();
            }, 5000);
            this._panel.webview.postMessage({ command: 'autoRefreshStarted' });
        }
    }

    public dispose() {
        LogViewerPanel.currentPanel = undefined;

        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
        await this.refreshLogs();
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Railway Deployment Logs</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 0;
                        margin: 0;
                    }
                    .header {
                        position: sticky;
                        top: 0;
                        background-color: var(--vscode-editor-background);
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding: 10px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        z-index: 100;
                    }
                    .controls {
                        display: flex;
                        gap: 10px;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 6px 14px;
                        cursor: pointer;
                        border-radius: 2px;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .logs-container {
                        padding: 10px;
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                        line-height: 1.5;
                    }
                    .log-entry {
                        margin: 2px 0;
                        padding: 4px 8px;
                        border-radius: 2px;
                        word-wrap: break-word;
                        white-space: pre-wrap;
                    }
                    .log-entry.info {
                        color: var(--vscode-foreground);
                    }
                    .log-entry.warning {
                        color: var(--vscode-editorWarning-foreground);
                        background-color: var(--vscode-editorWarning-background);
                    }
                    .log-entry.error {
                        color: var(--vscode-editorError-foreground);
                        background-color: var(--vscode-editorError-background);
                    }
                    .timestamp {
                        color: var(--vscode-descriptionForeground);
                        margin-right: 10px;
                        font-size: 0.9em;
                    }
                    .status {
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.9em;
                    }
                    .status.active {
                        background-color: var(--vscode-statusBarItem-prominentBackground);
                        color: var(--vscode-statusBarItem-prominentForeground);
                    }
                    .empty-state {
                        text-align: center;
                        padding: 40px;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <strong>${this.logType === 'deployment' ? 'Deployment' : 'Application'}: ${
                            this.resource.name || (this.resource.id ? this.resource.id.substring(0, 8) : 'Logs')
                        }</strong>
                        ${this.logType === 'deployment' && this.resource.status ? `<span class="status">${this.resource.status}</span>` : ''}
                    </div>
                    <div class="controls">
                        <button onclick="refresh()">Refresh</button>
                        <button id="autoRefreshBtn" onclick="toggleAutoRefresh()">Auto-refresh: OFF</button>
                        <button onclick="clearLogs()">Clear</button>
                    </div>
                </div>
                <div id="logs" class="logs-container">
                    <div class="empty-state">Loading logs...</div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    let autoRefresh = false;

                    function refresh() {
                        vscode.postMessage({ command: 'refresh' });
                    }

                    function toggleAutoRefresh() {
                        vscode.postMessage({ command: 'toggleAutoRefresh' });
                    }

                    function clearLogs() {
                        vscode.postMessage({ command: 'clearLogs' });
                    }

                    function formatTimestamp(timestamp) {
                        const date = new Date(timestamp);
                        return date.toLocaleTimeString();
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateLogs':
                                const logsContainer = document.getElementById('logs');
                                if (message.logs && message.logs.length > 0) {
                                    logsContainer.innerHTML = message.logs
                                        .map(log => \`
                                            <div class="log-entry \${log.severity}">
                                                <span class="timestamp">\${formatTimestamp(log.timestamp)}</span>
                                                \${log.message}
                                            </div>
                                        \`)
                                        .join('');
                                    logsContainer.scrollTop = logsContainer.scrollHeight;
                                } else {
                                    logsContainer.innerHTML = '<div class="empty-state">No logs available</div>';
                                }
                                break;
                            case 'clearLogs':
                                document.getElementById('logs').innerHTML = '<div class="empty-state">Logs cleared</div>';
                                break;
                            case 'autoRefreshStarted':
                                autoRefresh = true;
                                document.getElementById('autoRefreshBtn').textContent = 'Auto-refresh: ON';
                                document.getElementById('autoRefreshBtn').classList.add('active');
                                break;
                            case 'autoRefreshStopped':
                                autoRefresh = false;
                                document.getElementById('autoRefreshBtn').textContent = 'Auto-refresh: OFF';
                                document.getElementById('autoRefreshBtn').classList.remove('active');
                                break;
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}