# Railway Monitor for VS Code

Monitor your Railway deployments and logs directly from VS Code.

![CI](https://github.com/phillipbroberts/railway-vscode/workflows/CI/badge.svg)
![Version](https://img.shields.io/visual-studio-marketplace/v/your-publisher-name.railway-monitor)
![Downloads](https://img.shields.io/visual-studio-marketplace/d/your-publisher-name.railway-monitor)

## Features

- 🚂 **Real-time Deployment Monitoring** - View all your Railway projects, environments, services, and deployments in a tree view
- 📊 **Deployment Status** - Visual indicators for deployment status (success, failed, building, etc.)
- 📝 **Deployment Logs** - View build and deployment logs with one click
- 🔔 **Status Notifications** - Get notified when deployments complete
- 🔄 **Auto-refresh** - Automatically updates every 30 seconds
- 👥 **Team Support** - Works with both personal and team API tokens

## Installation

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=your-publisher-name.railway-monitor)
2. Or search for "Railway Monitor" in VS Code Extensions

## Setup

1. Get your Railway API token from [https://railway.app/account/tokens](https://railway.app/account/tokens)
2. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
3. Run "Railway: Set API Token"
4. Paste your token

## Usage

### View Deployments
- Click the Railway icon in the Activity Bar (left sidebar)
- Navigate through Projects → Environments → Services → Deployments

### View Logs
- **Deployment Logs**: Click on any deployment in the tree
- **Application Logs**: Coming soon!

### Commands
- `Railway: Set API Token` - Configure your Railway API token
- `Railway: Clear API Token` - Remove stored token
- `Railway: Refresh Deployments` - Manually refresh the deployment tree

## Development

### Prerequisites
- Node.js 18.x or higher
- npm or yarn

### Setup
```bash
git clone https://github.com/phillipbroberts/railway-vscode.git
cd railway-vscode
npm install
```

### Running locally
1. Open in VS Code
2. Press `F5` to launch Extension Development Host
3. The extension will be available in the new VS Code window

### Building
```bash
npm run compile  # Compile TypeScript
npm run watch    # Watch mode
npm run lint     # Run linter
npm test         # Run tests
```

### Publishing

#### Automated (GitHub Actions)
1. Create a release on GitHub
2. GitHub Actions will automatically publish to VS Code Marketplace

#### Manual
```bash
npm install -g @vscode/vsce
vsce package
vsce publish
```

## CI/CD

This project uses GitHub Actions for:
- **CI**: Runs on every push and PR (testing, linting, building)
- **Publishing**: Automatically publishes to VS Code Marketplace on release
- **Version Bumping**: Workflow for automated version management

### Setting up Publishing
1. Create a Personal Access Token at [Azure DevOps](https://dev.azure.com/)
2. Add it as `VSCE_PAT` secret in GitHub repository settings

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Known Issues

- Application/runtime logs are not yet available (Railway API limitation)
- Right-click context menus may not appear on some systems

## Roadmap

- [ ] Application/runtime logs support
- [ ] Deployment rollback functionality
- [ ] Environment variable management
- [ ] Service restart capabilities
- [ ] Resource usage monitoring

## License

MIT - see [LICENSE](LICENSE) file for details

## Support

- [Report Issues](https://github.com/phillipbroberts/railway-vscode/issues)
- [Request Features](https://github.com/phillipbroberts/railway-vscode/issues/new)

## Credits

Created by [Phillip Roberts](https://github.com/phillipbroberts)

---

**Enjoy monitoring your Railway deployments!** 🚂