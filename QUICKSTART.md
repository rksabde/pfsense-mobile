# Quick Start Guide

Get your pfSense WiFi Manager running in 5 minutes!

## Step 1: Enable pfSense API

1. Log into pfSense web interface
2. Navigate to **System > Advanced > Admin Access**
3. Scroll to **API** section
4. Check **Enable API**
5. Click **Save**

## Step 2: Generate API Credentials

1. Go to **System > User Manager**
2. Click on **admin** user (or create new user)
3. Scroll to **API Keys** section
4. Click **+ Add**
5. Copy the **Client ID** (API Key) and **Token** (API Secret)
6. Store them securely (you'll need them in Step 4)

## Step 3: Create BLOCKED Alias

1. Go to **Firewall > Aliases**
2. Click **+ Add**
3. Configure:
   - **Name**: `BLOCKED`
   - **Type**: `Host(s)`
   - **Description**: `Devices blocked by WiFi Manager`
4. Click **Save**
5. Click **Apply Changes**

## Step 4: Create Firewall Rule (Important!)

1. Go to **Firewall > Rules**
2. Select your LAN interface (or WiFi interface)
3. Click **Add** (arrow up to add rule at top)
4. Configure:
   - **Action**: `Block`
   - **Interface**: `LAN` (or your WiFi interface)
   - **Source**: Click "Single host or alias" and select `BLOCKED`
   - **Destination**: `any`
   - **Description**: `Block devices in BLOCKED alias`
5. Click **Save**
6. Click **Apply Changes**

## Step 5: Configure Application

1. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your details:
   ```env
   PFSENSE_URL=https://192.168.1.1
   PFSENSE_API_KEY=your_client_id_from_step_2
   PFSENSE_API_SECRET=your_token_from_step_2
   ADMIN_PASSWORD=choose_a_strong_password
   BLOCKED_ALIAS_NAME=BLOCKED
   ```

## Step 6: Start the Application

```bash
# Build and start
docker-compose up -d

# Check status
docker-compose ps

# View logs (optional)
docker-compose logs -f
```

## Step 7: Access the Application

1. Open browser: `http://localhost:8080`
2. Login with the password from your `.env` file
3. Start managing devices!

## Testing the Setup

1. Go to **Connected Clients** page
2. Find a device
3. Click **Block** button
4. Device should lose internet access immediately
5. Click **Unblock** to restore access

## Common Issues

### "Authentication required" error
- Check API key and secret are correct
- Ensure they're properly copied without extra spaces

### "Failed to fetch clients"
- Verify pfSense URL is correct
- Check pfSense is accessible from Docker container
- Try accessing pfSense URL from your browser

### Block/Unblock doesn't work
- Verify BLOCKED alias exists
- Check firewall rule is above any allow rules
- Ensure firewall rule references BLOCKED alias

### Cannot access application
- Check Docker containers are running: `docker-compose ps`
- Check logs: `docker-compose logs backend`
- Verify port 8080 is not in use by another application

## Next Steps

- Customize the blocked alias name if needed
- Set up HTTPS with a reverse proxy (recommended for production)
- Explore the dashboard and statistics
- Create firewall rules for time-based blocking (advanced)

## Need Help?

Check the main README.md for detailed troubleshooting and documentation.
