# pfSense WiFi Manager

A mobile-first web application for managing pfSense router WiFi clients through a modern, intuitive interface. Block/unblock devices, view connected clients, and monitor your network with ease.

## Features

### Phase 1 (Implemented)
- **Dashboard** - Overview statistics and quick actions
- **Connected Clients** - View all connected devices with block/unblock toggle
- **Blocked Clients** - Manage all blocked devices
- **Simple Authentication** - Password-protected access
- **Mobile-First UI** - Optimized for mobile devices with responsive design
- **Auto-Refresh** - Real-time updates every 30 seconds

### Tech Stack
- **Backend**: Node.js + Express
- **Frontend**: Vue.js 3 + Vite
- **Deployment**: Docker + Docker Compose
- **API**: pfSense API v2

## Prerequisites

1. **pfSense Router**
   - pfSense installed and running
   - API v2 enabled (System > Advanced > Admin Access)
   - API key and secret generated

2. **Docker & Docker Compose**
   - Docker Engine installed
   - Docker Compose installed

3. **Firewall Alias**
   - Create a firewall alias named `BLOCKED` (or custom name)
   - Type: Host(s)
   - Go to: Firewall > Aliases > Add

4. **Firewall Rule**
   - Create a rule to block traffic from the BLOCKED alias
   - Example: Block all traffic from BLOCKED alias to any destination

## Setup Instructions

### 1. Clone or Download the Project

```bash
cd /path/to/project21
```

### 2. Configure Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# pfSense Configuration
PFSENSE_URL=https://192.168.1.1
PFSENSE_API_KEY=your_api_key_here
PFSENSE_API_SECRET=your_api_secret_here

# Application Configuration
ADMIN_PASSWORD=your_secure_password
BLOCKED_ALIAS_NAME=BLOCKED
```

### 3. Get pfSense API Credentials

1. Log into pfSense web interface
2. Go to **System > User Manager**
3. Create or edit a user with necessary privileges
4. Scroll down to **API Keys** section
5. Click **+ Add** to generate API key/secret
6. Copy the key and secret to your `.env` file

Required privileges for API user:
- Firewall: Aliases
- DHCP Server
- Diagnostics: ARP Table
- Status: System

### 4. Build and Run with Docker Compose

```bash
# Build the containers
docker-compose build

# Start the application
docker-compose up -d

# View logs
docker-compose logs -f
```

The application will be available at:
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3000

### 5. Access the Application

1. Open your browser and navigate to `http://localhost:8080` (or your server IP)
2. Log in with the password you set in `.env`
3. Start managing your WiFi clients

## Usage

### Dashboard
- View total connected devices
- See blocked device counts
- Quick navigation to other pages
- System information display

### Connected Clients Page
- View all devices currently connected to your network
- See device hostname, MAC address, IP, and status
- Toggle block/unblock for each device
- Auto-refreshes every 30 seconds

### Blocked Clients Page
- View all blocked devices
- Unblock devices individually
- Shows both online and offline blocked devices

### Blocking/Unblocking Workflow

When you **block** a device:
1. The device's MAC address is added to the BLOCKED alias in pfSense
2. pfSense firewall rules automatically apply
3. Device loses network access (based on your firewall rules)

When you **unblock** a device:
1. The device's MAC address is removed from the BLOCKED alias
2. Changes are applied immediately
3. Device regains network access

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with password

### Clients
- `GET /api/clients/connected` - List all connected clients
- `GET /api/clients/blocked` - List all blocked clients
- `POST /api/clients/:mac/block` - Block a device by MAC
- `POST /api/clients/:mac/unblock` - Unblock a device by MAC

### Statistics
- `GET /api/stats/overview` - Get dashboard statistics

### Health Check
- `GET /health` - API health check

## Development

### Run Locally (Without Docker)

**Backend:**
```bash
cd backend
npm install
cp ../.env .env
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Frontend will be at `http://localhost:5173` and will proxy API requests to backend.

### Project Structure

```
project21/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app entry point
│   │   ├── middleware/
│   │   │   └── auth.js           # Simple auth middleware
│   │   ├── routes/
│   │   │   ├── clients.js        # Client management routes
│   │   │   └── stats.js          # Statistics routes
│   │   └── services/
│   │       └── pfsense.js        # pfSense API integration
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.js               # Vue app entry
│   │   ├── App.vue               # Root component
│   │   ├── router/
│   │   │   └── index.js          # Vue Router config
│   │   ├── stores/
│   │   │   └── auth.js           # Pinia auth store
│   │   ├── views/
│   │   │   ├── LoginView.vue
│   │   │   ├── DashboardView.vue
│   │   │   ├── ConnectedClientsView.vue
│   │   │   └── BlockedClientsView.vue
│   │   └── components/
│   │       └── NavigationBar.vue
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## Troubleshooting

### Cannot connect to pfSense API
- Verify pfSense URL is correct in `.env`
- Check API key and secret are valid
- Ensure pfSense API v2 is enabled
- Check if pfSense has SSL certificate issues (app accepts self-signed certs)
- Verify firewall rules allow API access from Docker containers

### No clients showing up
- Verify DHCP is enabled on pfSense
- Check if devices are actually connected
- Ensure API user has DHCP and ARP table access permissions

### Block/Unblock not working
- Verify BLOCKED alias exists in pfSense
- Check BLOCKED_ALIAS_NAME in `.env` matches the alias name in pfSense
- Ensure firewall rules reference the BLOCKED alias
- Verify API user has Firewall: Aliases permissions

### Docker issues
```bash
# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check logs
docker-compose logs backend
docker-compose logs frontend
```

## Security Considerations

- Change the default `ADMIN_PASSWORD` immediately
- Use HTTPS in production (configure reverse proxy)
- Restrict access to the application (firewall rules, VPN)
- Regularly update dependencies
- Use strong API credentials for pfSense
- Consider implementing rate limiting for production

## Future Enhancements (Planned Phases)

### Phase 2
- User profiles and device grouping
- Device nicknames and custom labels
- Historical connection logs

### Phase 3
- Time-based blocking schedules
- Bandwidth monitoring per device
- Notifications for new devices

### Phase 4
- Multiple admin users
- Device usage statistics
- Export reports

## Contributing

This is a personal project. Feel free to fork and modify for your needs.

## License

MIT License - Use at your own risk

## Support

For issues related to:
- **pfSense**: Consult pfSense documentation
- **This application**: Check logs and troubleshooting section above

## Acknowledgments

- pfSense for the excellent router/firewall platform
- Vue.js and Express.js communities
