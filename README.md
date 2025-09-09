# Railway Monitor for VS Code

A Visual Studio Code extension for monitoring Railway deployments and viewing application logs directly within your IDE.

## Features

- 🚂 **Real-time Deployment Status**: View all your Railway projects, environments, services, and deployments in a tree view
- 📝 **Live Log Streaming**: Access deployment logs with auto-refresh capabilities
- 🔄 **Auto-refresh**: Automatically updates deployment status at configurable intervals
- 🔐 **Secure Authentication**: Store your Railway API token securely in VS Code settings
- 🎨 **Theme Integration**: Seamlessly integrates with your VS Code theme

## Installation

1. Install from the VS Code Marketplace (coming soon)
2. Or install manually:
   - Clone this repository
   - Run `npm install` in the project directory
   - Run `npm run compile` to build the extension
   - Press `F5` in VS Code to run the extension in a new Extension Development Host window

## Setup

1. Get your Railway API token from [Railway Dashboard](https://railway.app/account/tokens)
2. When you first activate the extension, you'll be prompted to enter your API token
3. Alternatively, you can set it via:
   - Command Palette: `Railway: Set API Token`
   - Or in VS Code settings: `railwayMonitor.apiToken`

## Usage

### View Deployments
- Open the Explorer sidebar in VS Code
- Find the "Railway Deployments" section
- Browse through your projects, environments, services, and deployments
- Deployment status is indicated by icons:
  - ✅ Success
  - ❌ Failed/Crashed
  - 🔄 Building/Deploying
  - ⭕ Cancelled/Removed

### View Logs
- Click on any deployment in the tree view to open its logs
- Use the log viewer controls to:
  - Refresh logs manually
  - Toggle auto-refresh (updates every 5 seconds)
  - Clear the log display

### Commands
All commands are available through the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- `Railway: Refresh Deployments` - Manually refresh the deployment tree
- `Railway: Set API Token` - Configure your Railway API token
- `Railway: Clear API Token` - Remove the stored API token
- `Railway: Show Deployment Logs` - View logs for a specific deployment

## Configuration

This extension contributes the following settings:

- `railwayMonitor.apiToken`: Your Railway API token
- `railwayMonitor.autoRefreshInterval`: Auto-refresh interval in seconds (default: 30)

## Development

### Prerequisites
- Node.js 16.x or higher
- VS Code 1.103.0 or higher

### Building from Source
```bash
# Clone the repository
git clone https://github.com/yourusername/railway-monitor-vscode.git
cd railway-monitor-vscode/railway-monitor

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test
```

### Testing the Extension
1. Open the project in VS Code
2. Press `F5` to open a new VS Code window with the extension loaded
3. Open a project and test the Railway Monitor features

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 R Software & Consulting, LLC

## Support

If you encounter any issues or have feature requests, please file them in the [GitHub Issues](https://github.com/yourusername/railway-monitor-vscode/issues) section.

## Acknowledgments

- Railway for providing the API and platform
- VS Code team for the excellent extension API
- All contributors and users of this extension