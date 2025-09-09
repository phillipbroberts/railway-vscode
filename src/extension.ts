import * as vscode from 'vscode';
import { RailwayAPI } from './railway-api';
import { DeploymentTreeDataProvider } from './deployment-tree-provider';
import { LogViewerPanel } from './log-viewer';

let railwayAPI: RailwayAPI;
let treeDataProvider: DeploymentTreeDataProvider;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Railway Monitor extension is now active!');
    vscode.window.showInformationMessage('Railway Monitor extension loaded - check Activity Bar for Railway icon');

    railwayAPI = new RailwayAPI();
    
    // Initialize API in background - don't block activation
    setTimeout(async () => {
        try {
            const initialized = await railwayAPI.initialize();
            if (!initialized) {
                vscode.window.showWarningMessage('Railway Monitor: Use "Railway: Set API Token" command to configure your token');
            } else {
                // Successfully initialized - refresh the tree view
                console.log('Railway API initialized successfully, refreshing tree view');
                treeDataProvider.refresh();
            }
        } catch (error) {
            console.error('Failed to initialize Railway API:', error);
        }
    }, 100);

    treeDataProvider = new DeploymentTreeDataProvider(railwayAPI);
    const treeView = vscode.window.createTreeView('railwayDeployments', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: true
    });

    context.subscriptions.push(treeView);

    const refreshCommand = vscode.commands.registerCommand('railwayMonitor.refreshDeployments', async () => {
        await treeDataProvider.clearCache();
        vscode.window.showInformationMessage('Railway deployments refreshed');
    });

    const showLogsCommand = vscode.commands.registerCommand('railwayMonitor.showDeploymentLogs', (deployment) => {
        LogViewerPanel.createOrShow(context.extensionUri, deployment, railwayAPI, 'deployment');
    });
    
    const showAppLogsCommand = vscode.commands.registerCommand('railwayMonitor.showApplicationLogs', (service) => {
        LogViewerPanel.createOrShow(context.extensionUri, service, railwayAPI, 'application');
    });

    const clearTokenCommand = vscode.commands.registerCommand('railwayMonitor.clearApiToken', async () => {
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to clear your Railway API token?',
            'Yes',
            'No'
        );
        
        if (confirm === 'Yes') {
            await railwayAPI.clearApiToken();
            vscode.window.showInformationMessage('Railway API token cleared');
            treeDataProvider.refresh();
        }
    });

    const setTokenCommand = vscode.commands.registerCommand('railwayMonitor.setApiToken', () => {
        console.log('Set API Token command triggered');
        vscode.window.showInformationMessage('Token command running...');
        
        // Show input box immediately without any blocking operations
        vscode.window.showInputBox({
            prompt: 'Enter your Railway API Token from https://railway.app/account/tokens',
            placeHolder: 'Paste your token here (UUID format)',
            password: true,
            ignoreFocusOut: true
        }).then(async (token) => {
            if (token) {
                console.log('Token received, length:', token.length);
                vscode.window.showInformationMessage('Saving token...');
                
                try {
                    // Clear old token first
                    await railwayAPI.clearApiToken();
                    
                    // Save the new token
                    const config = vscode.workspace.getConfiguration('railwayMonitor');
                    await config.update('apiToken', token.trim(), vscode.ConfigurationTarget.Global);
                    console.log('Token saved to configuration');
                    
                    // Reinitialize with new token
                    const reinitialized = await railwayAPI.initialize();
                    if (reinitialized) {
                        vscode.window.showInformationMessage('Railway API token set successfully');
                        treeDataProvider.refresh();
                    } else {
                        vscode.window.showErrorMessage('Failed to authenticate with Railway API. Please check your token.');
                    }
                } catch (error) {
                    console.error('Error setting token:', error);
                    vscode.window.showErrorMessage('Failed to save token: ' + error);
                }
            } else {
                console.log('No token provided');
            }
        });
    });

    context.subscriptions.push(
        refreshCommand,
        showLogsCommand,
        showAppLogsCommand,
        clearTokenCommand,
        setTokenCommand
    );

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(cloud) Railway';
    statusBarItem.tooltip = 'Railway Monitor';
    statusBarItem.command = 'railwayMonitor.refreshDeployments';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('railwayMonitor.apiToken')) {
            const reinitialized = await railwayAPI.initialize();
            if (reinitialized) {
                treeDataProvider.refresh();
            }
        }
    });
}

export function deactivate() {
    if (treeDataProvider) {
        treeDataProvider.stopAutoRefresh();
    }
}