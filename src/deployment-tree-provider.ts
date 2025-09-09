import * as vscode from 'vscode';
import { RailwayAPI, RailwayProject, RailwayService, RailwayDeployment, RailwayEnvironment } from './railway-api';

export class DeploymentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'project' | 'environment' | 'service' | 'deployment',
        public readonly data?: any,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        // Set contextValue to match the itemType for context menu items
        this.contextValue = itemType;
        
        if (itemType === 'deployment' && data) {
            this.iconPath = this.getDeploymentIcon(data.status);
            this.tooltip = `${data.status} - ${new Date(data.updatedAt).toLocaleString()}`;
            this.description = data.status;
        } else if (itemType === 'project') {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else if (itemType === 'environment') {
            this.iconPath = new vscode.ThemeIcon('server-environment');
        } else if (itemType === 'service') {
            this.iconPath = new vscode.ThemeIcon('server-process');
        }
    }

    private getDeploymentIcon(status: string): vscode.ThemeIcon {
        switch (status) {
            case 'SUCCESS':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            case 'FAILED':
            case 'CRASHED':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            case 'BUILDING':
            case 'DEPLOYING':
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
            case 'CANCELLED':
            case 'REMOVED':
            case 'REMOVING':
                return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.gray'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}

export class DeploymentTreeDataProvider implements vscode.TreeDataProvider<DeploymentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DeploymentTreeItem | undefined | null | void> = new vscode.EventEmitter<DeploymentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DeploymentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projects: RailwayProject[] = [];
    private environments: Map<string, RailwayEnvironment[]> = new Map();
    private services: Map<string, RailwayService[]> = new Map();
    private deployments: Map<string, RailwayDeployment[]> = new Map();
    private deploymentStatuses: Map<string, string> = new Map(); // Track deployment statuses
    private refreshInterval: NodeJS.Timeout | undefined;

    constructor(private railwayAPI: RailwayAPI) {
        this.startAutoRefresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    startAutoRefresh(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.refreshInterval = setInterval(async () => {
            await this.checkDeploymentStatuses();
            this.refresh();
        }, 30000);
    }
    
    private async checkDeploymentStatuses(): Promise<void> {
        // Check all current deployments for status changes
        for (const [key, deploymentList] of this.deployments.entries()) {
            for (const deployment of deploymentList) {
                const previousStatus = this.deploymentStatuses.get(deployment.id);
                const currentStatus = deployment.status;
                
                // Store current status
                this.deploymentStatuses.set(deployment.id, currentStatus);
                
                // Show notification if status changed to a final state
                if (previousStatus && previousStatus !== currentStatus) {
                    this.notifyDeploymentStatusChange(deployment, previousStatus, currentStatus);
                }
            }
        }
    }
    
    private notifyDeploymentStatusChange(deployment: RailwayDeployment, previousStatus: string, currentStatus: string): void {
        const wasBuilding = ['BUILDING', 'DEPLOYING'].includes(previousStatus);
        
        if (wasBuilding) {
            if (currentStatus === 'SUCCESS') {
                vscode.window.showInformationMessage(
                    `✅ Deployment successful! (${new Date().toLocaleTimeString()})`,
                    'View Logs'
                ).then(action => {
                    if (action === 'View Logs') {
                        vscode.commands.executeCommand('railwayMonitor.showDeploymentLogs', deployment);
                    }
                });
            } else if (currentStatus === 'FAILED' || currentStatus === 'CRASHED') {
                vscode.window.showErrorMessage(
                    `❌ Deployment ${currentStatus.toLowerCase()}! (${new Date().toLocaleTimeString()})`,
                    'View Logs'
                ).then(action => {
                    if (action === 'View Logs') {
                        vscode.commands.executeCommand('railwayMonitor.showDeploymentLogs', deployment);
                    }
                });
            } else if (currentStatus === 'CANCELLED') {
                vscode.window.showWarningMessage(
                    `⚠️ Deployment cancelled (${new Date().toLocaleTimeString()})`
                );
            }
        }
    }

    stopAutoRefresh(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = undefined;
        }
    }

    getTreeItem(element: DeploymentTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DeploymentTreeItem): Promise<DeploymentTreeItem[]> {
        if (!element) {
            console.log('Getting root level projects...');
            this.projects = await this.railwayAPI.getProjects();
            console.log(`Found ${this.projects.length} projects`);
            
            if (this.projects.length === 0) {
                console.log('No projects found - check if token has access to any projects');
                return [new DeploymentTreeItem(
                    'No projects found',
                    vscode.TreeItemCollapsibleState.None,
                    'project'
                )];
            }
            
            return this.projects.map(project => 
                new DeploymentTreeItem(
                    project.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'project',
                    project
                )
            );
        }

        if (element.itemType === 'project' && element.data) {
            const projectId = element.data.id;
            let envs = this.environments.get(projectId);
            
            if (!envs) {
                envs = await this.railwayAPI.getProjectEnvironments(projectId);
                this.environments.set(projectId, envs);
            }

            return envs.map(env => 
                new DeploymentTreeItem(
                    env.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'environment',
                    { ...env, projectId }
                )
            );
        }

        if (element.itemType === 'environment' && element.data) {
            const projectId = element.data.projectId;
            let projectServices = this.services.get(projectId);
            
            if (!projectServices) {
                projectServices = await this.railwayAPI.getServices(projectId);
                this.services.set(projectId, projectServices);
            }

            return projectServices.map(service => {
                const serviceData = { 
                    ...service, 
                    environmentId: element.data.id,
                    serviceId: service.id,  // Ensure serviceId is present
                    name: service.name      // Ensure name is present
                };
                const item = new DeploymentTreeItem(
                    service.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'service',
                    serviceData,
                    {
                        command: 'railwayMonitor.showApplicationLogs',
                        title: 'Show Application Logs',
                        arguments: [serviceData]
                    }
                );
                // Add tooltip and ensure context value is set
                item.tooltip = `Service: ${service.name}\nClick to view application logs\nExpand to see deployments`;
                item.contextValue = 'service';  // This is crucial for right-click menu
                return item;
            });
        }

        if (element.itemType === 'service' && element.data) {
            const key = `${element.data.id}-${element.data.environmentId}`;
            let serviceDeployments = this.deployments.get(key);
            
            if (!serviceDeployments) {
                serviceDeployments = await this.railwayAPI.getDeployments(
                    element.data.id,
                    element.data.environmentId
                );
                this.deployments.set(key, serviceDeployments);
            }

            return serviceDeployments.map(deployment => {
                const item = new DeploymentTreeItem(
                    `${deployment.status} - ${new Date(deployment.createdAt).toLocaleTimeString()}`,
                    vscode.TreeItemCollapsibleState.None,
                    'deployment',
                    deployment,
                    {
                        command: 'railwayMonitor.showDeploymentLogs',
                        title: 'Show Deployment Logs',
                        arguments: [deployment]
                    }
                );
                item.tooltip = `Deployment: ${deployment.id.substring(0, 8)}\nStatus: ${deployment.status}\nCreated: ${new Date(deployment.createdAt).toLocaleString()}\nClick to view deployment logs`;
                item.contextValue = 'deployment';
                return item;
            });
        }

        return [];
    }

    async clearCache(): Promise<void> {
        this.projects = [];
        this.environments.clear();
        this.services.clear();
        this.deployments.clear();
        this.refresh();
    }
}