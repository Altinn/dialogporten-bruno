# Dialogporten Bruno Collection

A comprehensive API testing collection for the Dialogporten platform, part of the Altinn ecosystem.

## Getting Started

To get up and running, you need to:

### 1. Install Bruno

Bruno is an open-source API client for exploring and testing APIs. You can install it using one of the following methods:

#### macOS
- **Direct Download**: Download from the [official downloads page](https://www.usebruno.com/downloads)
- **Homebrew**: `brew install bruno`

#### Windows
- **Direct Download**: Download the Windows installer from the [official downloads page](https://www.usebruno.com/downloads)
- **Package Managers**:
  - Chocolatey: `choco install bruno`
  - Winget: `winget install Bruno.Bruno`
  - Scoop: `scoop install bruno`

#### Linux
- **Direct Download**: Download the Linux package from the [official downloads page](https://www.usebruno.com/downloads)
- **Package Managers**:
  - Debian/Ubuntu: Follow the [official installation guide](https://docs.usebruno.com/get-started/bruno-basics/download)
  - Flatpak: `flatpak install flathub com.usebruno.Bruno`
  - Snap: `sudo snap install bruno`

### 2. Open the Collection

Once Bruno is installed:

1. **Open Bruno** on your system
2. **Click "Open Collection"** from the home screen
3. **Navigate to this folder** (`dialogporten-bruno`) and select it
4. The collection will load with all the organized requests and environments

### 3. Configure Environment Variables

1. **Create your own `.env` file** based on the included `example.env` file.
   ```bash
   cp example.env .env
   ```

2. **Edit the `.env` file** with your actual credentials and configuration values:
   ```bash
   # Open .env in your preferred text editor
   # Replace placeholder values with your real credentials
   # Example: API_KEY=your_actual_api_key_here
   ```

3. **Select an environment** from the dropdown in Bruno (e.g., "Local development", "Staging", "Production")
4. **Update environment variables** as needed for your specific setup

## Collection Structure

This collection is organized into two main sections:

- **EndUser**: API endpoints for end users interacting with dialogs
- **ServiceOwner**: API endpoints for service owners managing dialogs and activities

Each section contains organized folders for different resource types (Dialogs, DialogActivities, etc.) with corresponding API requests.