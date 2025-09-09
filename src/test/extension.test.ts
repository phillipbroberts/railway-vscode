import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Railway Monitor Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting Railway Monitor tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('RSoftwareConsulting.railway-monitor'));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('RSoftwareConsulting.railway-monitor');
        assert.ok(ext);
        await ext!.activate();
        assert.strictEqual(ext!.isActive, true);
    });

    test('Should register all commands', async () => {
        const commands = await vscode.commands.getCommands();
        
        const expectedCommands = [
            'railwayMonitor.refreshDeployments',
            'railwayMonitor.showDeploymentLogs',
            'railwayMonitor.showApplicationLogs',
            'railwayMonitor.setApiToken',
            'railwayMonitor.clearApiToken'
        ];

        for (const cmd of expectedCommands) {
            assert.ok(
                commands.includes(cmd),
                `Command ${cmd} not found in registered commands`
            );
        }
    });

    test('Should create Railway Deployments tree view', () => {
        // Check if the tree view exists in the package.json contributions
        const ext = vscode.extensions.getExtension('RSoftwareConsulting.railway-monitor');
        assert.ok(ext);
        
        const packageJSON = ext!.packageJSON;
        assert.ok(packageJSON.contributes);
        assert.ok(packageJSON.contributes.views);
        assert.ok(packageJSON.contributes.views['railway-monitor']);
        
        const view = packageJSON.contributes.views['railway-monitor'].find(
            (v: any) => v.id === 'railwayDeployments'
        );
        assert.ok(view, 'Railway Deployments view not found');
    });

    test('Should have correct configuration properties', () => {
        const ext = vscode.extensions.getExtension('RSoftwareConsulting.railway-monitor');
        assert.ok(ext);
        
        const packageJSON = ext!.packageJSON;
        const configProps = packageJSON.contributes.configuration.properties;
        
        assert.ok(configProps['railwayMonitor.apiToken'], 'apiToken config not found');
        assert.ok(configProps['railwayMonitor.autoRefreshInterval'], 'autoRefreshInterval config not found');
    });
});