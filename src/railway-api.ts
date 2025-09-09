import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';

export interface RailwayProject {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface RailwayService {
    id: string;
    name: string;
    projectId: string;
}

export interface RailwayDeployment {
    id: string;
    status: 'BUILDING' | 'DEPLOYING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'CRASHED' | 'REMOVED' | 'REMOVING';
    staticUrl?: string;
    createdAt: string;
    updatedAt: string;
    serviceId: string;
    environmentId: string;
}

export interface RailwayEnvironment {
    id: string;
    name: string;
    projectId: string;
}

export interface DeploymentLog {
    message: string;
    timestamp: string;
    severity: 'info' | 'warning' | 'error';
}

export class RailwayAPI {
    private apiClient: AxiosInstance;
    private apiToken: string | undefined;

    constructor() {
        this.apiClient = axios.create({
            baseURL: 'https://backboard.railway.app/graphql/v2',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        // Add request/response interceptors for debugging
        this.apiClient.interceptors.request.use(request => {
            console.log('Making request to:', request.url);
            console.log('Request headers:', request.headers);
            return request;
        });

        this.apiClient.interceptors.response.use(
            response => {
                console.log('Response received:', response.status);
                return response;
            },
            error => {
                console.error('Request failed:', error.response?.status, error.response?.statusText);
                if (error.response?.data) {
                    console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
                }
                return Promise.reject(error);
            }
        );
    }

    async initialize(): Promise<boolean> {
        this.apiToken = await this.getApiToken();
        if (!this.apiToken) {
            return false;
        }

        // Trim any whitespace from the token
        this.apiToken = this.apiToken.trim();

        // Railway uses "Bearer" format for API tokens (now UUID format)
        this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${this.apiToken}`;
        console.log(`Setting authorization header with token (length: ${this.apiToken.length})`);
        
        // Test the connection with a simple query
        try {
            // First test if the endpoint is reachable with introspection
            const introspectionQuery = `
                query {
                    __schema {
                        queryType {
                            name
                        }
                    }
                }
            `;
            
            console.log('Testing Railway API endpoint...');
            const introspectionResponse = await this.apiClient.post('', { query: introspectionQuery });
            
            if (introspectionResponse.data?.data?.__schema) {
                console.log('Railway API endpoint is reachable');
            }
            
            // Now test authentication - use a simple introspection query that should always work
            const testQuery = `
                query {
                    __typename
                }
            `;
            
            console.log('Testing Railway API authentication...');
            console.log('API Endpoint:', this.apiClient.defaults.baseURL);
            console.log('Token length:', this.apiToken.length);
            
            const response = await this.apiClient.post('', { query: testQuery });
            
            // Check if response is HTML (error page)
            if (typeof response.data === 'string' && response.data.includes('<html')) {
                console.error('Railway API returned HTML during initialization. Token may be invalid.');
                vscode.window.showErrorMessage('Railway API token appears to be invalid. Please set a valid token.');
                return false;
            }
            
            if (response.data.errors) {
                console.error('Railway API initialization test had errors:', JSON.stringify(response.data.errors, null, 2));
                const errorMessage = response.data.errors[0]?.message || 'Unknown error';
                
                // Don't show error if it's just the auth test - the actual queries might work
                if (errorMessage.toLowerCase().includes('not authorized')) {
                    console.log('Auth test query failed, but will try actual queries');
                    // Return true anyway - the actual project queries handle auth better
                    return true;
                }
                
                vscode.window.showErrorMessage(`Railway API error: ${errorMessage}`);
                return false;
            }
            
            console.log('Railway API connection successful');
            return true;
        } catch (error: any) {
            console.error('Failed to initialize Railway API:', error.response?.data || error.message);
            
            if (error.response?.status === 401 || error.response?.status === 403) {
                vscode.window.showErrorMessage('Railway API authentication failed. Please check your API token.');
            } else {
                vscode.window.showErrorMessage(`Failed to connect to Railway API: ${error.message || 'Unknown error'}`);
            }
            return false;
        }
    }

    private async getApiToken(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('railwayMonitor');
        let token = config.get<string>('apiToken');

        if (!token) {
            token = await vscode.window.showInputBox({
                prompt: 'Enter your Railway API Token',
                placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                password: true,
                ignoreFocusOut: true
            });

            if (token) {
                // Trim whitespace before saving
                token = token.trim();
                await config.update('apiToken', token, vscode.ConfigurationTarget.Global);
            }
        }

        return token;
    }

    async getProjects(): Promise<RailwayProject[]> {
        console.log('Fetching Railway projects...');
        
        // Try both personal and team project queries
        const personalQuery = `
            query {
                me {
                    projects {
                        edges {
                            node {
                                id
                                name
                                description
                                createdAt
                                updatedAt
                            }
                        }
                    }
                }
            }
        `;
        
        // Query that works with both personal and team contexts
        const universalQuery = `
            query {
                projects {
                    edges {
                        node {
                            id
                            name
                            description
                            createdAt
                            updatedAt
                        }
                    }
                }
            }
        `;

        try {
            // First try the universal query that should work with team tokens
            console.log('Trying universal projects query...');
            let response = await this.apiClient.post('', { query: universalQuery });
            console.log('Universal query response:', JSON.stringify(response.data, null, 2));
            
            // If the universal query has errors, try the personal query
            if (response.data.errors) {
                console.log('Universal query failed (expected for personal tokens), trying personal query...');
                response = await this.apiClient.post('', { query: personalQuery });
                console.log('Personal query response:', JSON.stringify(response.data, null, 2));
                
                if (response.data.errors) {
                    console.error('Both queries failed:', response.data.errors);
                    // Only show error if both queries fail
                    const errorMsg = response.data.errors[0]?.message || 'Unknown error';
                    if (!errorMsg.toLowerCase().includes('not authorized')) {
                        vscode.window.showErrorMessage(`Railway API error: ${errorMsg}`);
                    }
                    return [];
                }
                
                // Personal query succeeded
                if (response.data?.data?.me?.projects?.edges) {
                    return response.data.data.me.projects.edges.map((edge: any) => edge.node);
                }
            }
            
            // Universal query succeeded
            if (response.data?.data?.projects?.edges) {
                return response.data.data.projects.edges.map((edge: any) => edge.node);
            }
            
            console.error('Unexpected response structure:', response.data);
            vscode.window.showErrorMessage('No projects found. Make sure your token has access to projects.');
            return [];
        } catch (error: any) {
            console.error('Error fetching projects:', error.response?.data || error.message);
            
            // Check if it's an authentication error
            if (error.response?.status === 401 || error.response?.status === 403) {
                vscode.window.showErrorMessage('Railway API authentication failed. Please check your API token.');
            } else if (error.response?.data && typeof error.response.data === 'string' && error.response.data.includes('<html')) {
                vscode.window.showErrorMessage('Railway API returned an error page. Please check your API token and try again.');
            } else {
                vscode.window.showErrorMessage(`Failed to fetch projects: ${error.message || error}`);
            }
            return [];
        }
    }

    async getProjectEnvironments(projectId: string): Promise<RailwayEnvironment[]> {
        const query = `
            query($projectId: String!) {
                project(id: $projectId) {
                    environments {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                }
            }
        `;

        try {
            console.log(`Fetching environments for project ${projectId}...`);
            const response = await this.apiClient.post('', {
                query,
                variables: { projectId }
            });
            
            if (response.data.errors) {
                console.error('Failed to fetch environments:', response.data.errors);
                return [];
            }
            
            if (!response.data?.data?.project?.environments?.edges) {
                console.log('No environments found for project');
                return [];
            }
            
            return response.data.data.project.environments.edges.map((edge: any) => ({
                ...edge.node,
                projectId
            }));
        } catch (error: any) {
            console.error('Error fetching environments:', error.response?.data || error.message);
            vscode.window.showErrorMessage(`Failed to fetch environments: ${error.message || error}`);
            return [];
        }
    }

    async getServices(projectId: string): Promise<RailwayService[]> {
        const query = `
            query($projectId: String!) {
                project(id: $projectId) {
                    services {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                }
            }
        `;

        try {
            console.log(`Fetching services for project ${projectId}...`);
            const response = await this.apiClient.post('', {
                query,
                variables: { projectId }
            });
            
            if (response.data.errors) {
                console.error('Failed to fetch services:', response.data.errors);
                return [];
            }
            
            if (!response.data?.data?.project?.services?.edges) {
                console.log('No services found for project');
                return [];
            }
            
            return response.data.data.project.services.edges.map((edge: any) => ({
                ...edge.node,
                projectId
            }));
        } catch (error: any) {
            console.error('Error fetching services:', error.response?.data || error.message);
            vscode.window.showErrorMessage(`Failed to fetch services: ${error.message || error}`);
            return [];
        }
    }

    async getDeployments(serviceId: string, environmentId: string): Promise<RailwayDeployment[]> {
        // Try the newer API structure first
        const query = `
            query($serviceId: String!, $environmentId: String!, $first: Int!) {
                deployments(
                    input: {
                        serviceId: $serviceId, 
                        environmentId: $environmentId
                    },
                    first: $first
                ) {
                    edges {
                        node {
                            id
                            status
                            staticUrl
                            createdAt
                            updatedAt
                        }
                    }
                }
            }
        `;
        
        // Fallback query with different structure
        const alternativeQuery = `
            query($serviceId: String!, $environmentId: String!) {
                service(id: $serviceId) {
                    deployments(environmentId: $environmentId, first: 10) {
                        edges {
                            node {
                                id
                                status
                                staticUrl
                                createdAt
                                updatedAt
                            }
                        }
                    }
                }
            }
        `;

        try {
            console.log(`Fetching deployments for service ${serviceId} in environment ${environmentId}...`);
            
            // Try the first query structure
            let response = await this.apiClient.post('', {
                query,
                variables: { serviceId, environmentId, first: 10 }
            });
            
            // If first query has errors, try the alternative
            if (response.data.errors) {
                console.log('First deployments query failed, trying alternative...');
                console.error('First query errors:', response.data.errors);
                
                response = await this.apiClient.post('', {
                    query: alternativeQuery,
                    variables: { serviceId, environmentId }
                });
                
                if (response.data.errors) {
                    console.error('Both deployment queries failed:', response.data.errors);
                    
                    // Log the exact error for debugging
                    const errorMessage = response.data.errors[0]?.message || 'Unknown error';
                    console.error('Deployment query error details:', errorMessage);
                    
                    return [];
                }
                
                // Alternative query succeeded - service.deployments structure
                if (response.data?.data?.service?.deployments?.edges) {
                    return response.data.data.service.deployments.edges.map((edge: any) => ({
                        ...edge.node,
                        serviceId,
                        environmentId
                    }));
                }
            }
            
            // First query succeeded
            if (response.data?.data?.deployments?.edges) {
                return response.data.data.deployments.edges.map((edge: any) => ({
                    ...edge.node,
                    serviceId,
                    environmentId
                }));
            }
            
            console.log('No deployments found');
            return [];
        } catch (error: any) {
            console.error('Error fetching deployments:', error.response?.data || error.message);
            if (error.response?.status === 400) {
                console.error('Bad request - likely invalid service or environment ID');
                console.error('ServiceId:', serviceId, 'EnvironmentId:', environmentId);
            }
            return [];
        }
    }

    async getDeploymentLogs(deploymentId: string, limit: number = 100): Promise<DeploymentLog[]> {
        // Try different query structures for deployment logs
        const queries = [
            // Query 1: Direct deployment logs
            {
                query: `
                    query($deploymentId: String!, $limit: Int!) {
                        deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
                            message
                            timestamp
                            severity
                        }
                    }
                `,
                extractor: (data: any) => data?.deploymentLogs
            },
            // Query 2: Logs through deployment object
            {
                query: `
                    query($deploymentId: String!, $limit: Int!) {
                        deployment(id: $deploymentId) {
                            logs(limit: $limit) {
                                message
                                timestamp
                                severity
                            }
                        }
                    }
                `,
                extractor: (data: any) => data?.deployment?.logs
            },
            // Query 3: Build logs specifically
            {
                query: `
                    query($deploymentId: String!, $limit: Int!) {
                        deployment(id: $deploymentId) {
                            buildLogs(limit: $limit) {
                                message
                                timestamp
                            }
                        }
                    }
                `,
                extractor: (data: any) => {
                    const logs = data?.deployment?.buildLogs;
                    if (logs) {
                        return logs.map((log: any) => ({
                            ...log,
                            severity: 'info'
                        }));
                    }
                    return null;
                }
            }
        ];

        console.log(`Fetching deployment logs for ${deploymentId}...`);
        
        for (const { query, extractor } of queries) {
            try {
                const response = await this.apiClient.post('', {
                    query,
                    variables: { deploymentId, limit }
                });
                
                if (!response.data.errors && response.data.data) {
                    const logs = extractor(response.data.data);
                    if (logs) {
                        console.log(`Successfully fetched ${logs.length} deployment logs`);
                        return logs;
                    }
                }
                
                if (response.data.errors) {
                    console.log('Query failed with errors:', response.data.errors[0]?.message);
                }
            } catch (error: any) {
                console.log('Query failed:', error.message);
            }
        }
        
        console.error('All deployment log queries failed');
        vscode.window.showWarningMessage('Unable to fetch deployment logs. The logs may not be available yet.');
        return [];
    }
    
    async getApplicationLogs(serviceId: string, environmentId: string, limit: number = 100): Promise<DeploymentLog[]> {
        // First, let's check what fields are available on the service
        const introspectionQuery = `
            query {
                __type(name: "Service") {
                    fields {
                        name
                        type {
                            name
                            kind
                        }
                    }
                }
            }
        `;
        
        try {
            const introspectionResponse = await this.apiClient.post('', { query: introspectionQuery });
            if (introspectionResponse.data?.data?.__type?.fields) {
                console.log('Available Service fields:', introspectionResponse.data.data.__type.fields
                    .filter((f: any) => f.name.toLowerCase().includes('log'))
                    .map((f: any) => f.name));
            }
        } catch (e) {
            console.log('Could not introspect Service type');
        }
        
        // Try different query structures for application/runtime logs
        const queries = [
            // Query 1: Direct logs query
            {
                query: `
                    query($serviceId: String!, $environmentId: String!, $limit: Int!) {
                        logs(
                            serviceId: $serviceId,
                            environmentId: $environmentId,
                            limit: $limit
                        ) {
                            message
                            timestamp
                            severity
                        }
                    }
                `,
                extractor: (data: any) => data?.logs
            },
            // Query 2: Through service object
            {
                query: `
                    query($serviceId: String!, $environmentId: String!, $limit: Int!) {
                        service(id: $serviceId) {
                            logs(environmentId: $environmentId, limit: $limit) {
                                message
                                timestamp
                                severity
                            }
                        }
                    }
                `,
                extractor: (data: any) => data?.service?.logs
            },
            // Query 3: Through service instance
            {
                query: `
                    query($serviceId: String!, $environmentId: String!, $limit: Int!) {
                        serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
                            logs(limit: $limit) {
                                message
                                timestamp
                                severity
                            }
                        }
                    }
                `,
                extractor: (data: any) => data?.serviceInstance?.logs
            },
            // Query 4: Get latest deployment and its logs
            {
                query: `
                    query($serviceId: String!, $environmentId: String!, $limit: Int!) {
                        deployments(
                            input: {
                                serviceId: $serviceId,
                                environmentId: $environmentId
                            },
                            first: 1
                        ) {
                            edges {
                                node {
                                    id
                                    logs(limit: $limit) {
                                        message
                                        timestamp
                                        severity
                                    }
                                }
                            }
                        }
                    }
                `,
                extractor: (data: any) => data?.deployments?.edges?.[0]?.node?.logs
            }
        ];

        console.log(`Fetching application logs for service ${serviceId} in environment ${environmentId}...`);
        console.log('Service data:', { serviceId, environmentId, limit });
        
        for (let i = 0; i < queries.length; i++) {
            const { query, extractor } = queries[i];
            console.log(`Trying query ${i + 1} of ${queries.length}...`);
            
            try {
                const response = await this.apiClient.post('', {
                    query,
                    variables: { serviceId, environmentId, limit }
                });
                
                console.log(`Query ${i + 1} response:`, JSON.stringify(response.data, null, 2).substring(0, 500));
                
                if (!response.data.errors && response.data.data) {
                    const logs = extractor(response.data.data);
                    if (logs && logs.length > 0) {
                        console.log(`Successfully fetched ${logs.length} application logs with query ${i + 1}`);
                        return logs;
                    } else {
                        console.log(`Query ${i + 1} returned no logs`);
                    }
                }
                
                if (response.data.errors) {
                    console.log(`Query ${i + 1} failed with errors:`, JSON.stringify(response.data.errors, null, 2));
                }
            } catch (error: any) {
                console.log(`Query ${i + 1} failed with exception:`, error.message);
            }
        }
        
        console.error('All application log queries failed');
        vscode.window.showWarningMessage('Unable to fetch application logs. Logs may not be available for this service.');
        return [];
    }
    
    async getDeploymentStatus(deploymentId: string): Promise<string | null> {
        const query = `
            query($deploymentId: String!) {
                deployment(id: $deploymentId) {
                    status
                    createdAt
                    updatedAt
                }
            }
        `;
        
        try {
            const response = await this.apiClient.post('', {
                query,
                variables: { deploymentId }
            });
            
            if (response.data.errors) {
                console.error('Failed to fetch deployment status:', response.data.errors);
                return null;
            }
            
            return response.data?.data?.deployment?.status || null;
        } catch (error: any) {
            console.error('Error fetching deployment status:', error.response?.data || error.message);
            return null;
        }
    }

    async clearApiToken(): Promise<void> {
        const config = vscode.workspace.getConfiguration('railwayMonitor');
        await config.update('apiToken', undefined, vscode.ConfigurationTarget.Global);
        this.apiToken = undefined;
        // Also clear the authorization header
        delete this.apiClient.defaults.headers.common['Authorization'];
        console.log('API token cleared from settings and memory');
    }
}