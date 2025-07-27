# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VCPToolBox is a revolutionary AI middleware system that extends AI capabilities through a plugin architecture. It acts as a "Variable & Command Protocol" layer that enables AI models to interact with external tools, manage persistent memory, and collaborate in distributed networks.

## Development Commands

### Node.js Commands
- **Start server**: `node server.js`
- **Install dependencies**: `npm install`
- **Clean install**: `rm -rf node_modules package-lock.json && npm install`

### Python Commands  
- **Install Python dependencies**: `python3 -m pip install -r requirements.txt`
- **Install plugin-specific Python deps**: Check individual Plugin folders for `requirements.txt`

### Setup Scripts (Linux/macOS)
- **Full installation**: `./scripts/vcp_setup.sh install`
- **Dependencies only**: `./scripts/vcp_setup.sh deps` 
- **Start server**: `./scripts/vcp_setup.sh start`

### Docker
- **Build and run**: `docker-compose up --build -d`
- **View logs**: `docker-compose logs -f`
- **Stop**: `docker-compose down`

## Core Architecture

### Server Structure
- **server.js**: Main application server handling HTTP requests, WebSocket connections, and AI model communication
- **Plugin.js**: Plugin management system supporting multiple plugin types (static, synchronous, asynchronous, service)
- **WebSocketServer.js**: Centralized WebSocket communication hub for real-time notifications and distributed nodes
- **routes/**: Express route modules for admin panel, task scheduling, and special model routing

### Plugin System
Plugins are located in the `Plugin/` directory. Each plugin has:
- **plugin-manifest.json**: Plugin configuration, capabilities, and API definitions
- **Implementation files**: JavaScript, Python, or other executable scripts
- **config.env**: Plugin-specific configuration (optional)

### Key Plugin Types
- **static**: Provide dynamic data via placeholder replacement (e.g., weather, daily notes)
- **synchronous**: Execute blocking operations and return immediate results 
- **asynchronous**: Handle long-running tasks with callback mechanisms
- **messagePreprocessor**: Modify user messages before sending to AI model
- **service**: Register HTTP routes for web services
- **hybridservice**: Combine messagePreprocessor and service capabilities

### Configuration System
- **config.env**: Main server configuration (copy from config.env.example)
- **Plugin/*/config.env**: Plugin-specific configurations
- **TVStxt/**: External text files for complex variable definitions

### Variable Replacement System
VCP supports dynamic placeholder replacement:
- **{{Date}}**, **{{Time}}**, **{{Today}}**: Current date/time information
- **{{VCP[PluginName]}}**: Auto-generated plugin command descriptions
- **{{Tar*}}**, **{{Var*}}**, **{{Sar*}}**: User-defined variables from config.env
- **{{角色名日记本}}**: Character-specific diary content
- **{{公共日记本}}**: Shared knowledge base content

## Development Workflows

### Adding New Plugins
1. Create directory in `Plugin/[PluginName]/`
2. Write `plugin-manifest.json` with proper type and capabilities
3. Implement plugin logic according to type requirements
4. Add plugin config template to `config.env.example` if needed
5. Test plugin functionality
6. Update system prompts to include new plugin via `{{VCP[PluginName]}}`

### Plugin Communication Protocols
- **stdio**: Standard input/output JSON communication
- **direct**: Direct Node.js module imports
- **WebSocket**: Real-time bidirectional communication for distributed nodes

### Memory System (Daily Notes)
- **dailynote/**: Character-specific and shared knowledge storage
- **DailyNoteGet**: Reads diary content into AI context
- **DailyNoteWrite**: AI writes structured diary entries
- **DailyNoteManager**: AI manages and organizes knowledge base

### Testing Plugins
1. Ensure plugin manifest is valid JSON
2. Test plugin execution independently 
3. Verify proper JSON response format for synchronous plugins
4. Test variable replacement in system prompts
5. Check WebSocket notifications for async plugins

### Distributed Architecture
- Main server handles plugin coordination and AI communication
- Distributed nodes (VCPDistributedServer) provide additional compute resources
- Plugins can be deployed across multiple machines transparently

## Important Files and Directories

### Core Files
- **server.js**: Main server entry point
- **Plugin.js**: Plugin management engine  
- **WebSocketServer.js**: WebSocket communication hub
- **config.env**: Primary configuration (create from example)

### Data Directories
- **Plugin/**: All plugin implementations
- **dailynote/**: AI memory and knowledge storage
- **image/**: Image storage for generated content
- **DebugLog/**: Server and plugin execution logs
- **TVStxt/**: External text file storage for variables

### Administrative
- **AdminPanel/**: Web-based management interface
- **scripts/**: Setup and management scripts
- **VCPChrome/**: Browser extension for web interaction

## Key Design Principles

1. **Model Agnostic**: Works with any AI model supporting chat completion API
2. **Plugin Extensibility**: Easy addition of new capabilities through plugins  
3. **Distributed Computing**: Seamless scaling across multiple machines
4. **Persistent Memory**: AI maintains context and learns through diary system
5. **Real-time Communication**: WebSocket-based notifications and updates
6. **Variable Injection**: Dynamic context modification through placeholder system

## Security Notes

- Store API keys in config.env, never commit to repository
- Use official API providers, avoid unofficial proxies
- Plugin execution is sandboxed through process isolation
- Admin panel requires authentication (set AdminUsername/AdminPassword)
- All WebSocket communications can be authenticated via VCP_Key

## Common Issues

- **Plugin not loading**: Check plugin-manifest.json syntax and plugin directory structure
- **Missing dependencies**: Run setup scripts or install Node.js/Python requirements
- **WebSocket connection failures**: Verify VCP_Key matches between main server and distributed nodes
- **Memory issues**: Monitor DebugLog/ for plugin execution errors
- **Port conflicts**: Adjust port settings in config.env

This codebase represents a next-generation AI middleware system focused on extensibility, distribution, and persistent learning capabilities.