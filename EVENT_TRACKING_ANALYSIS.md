# Event Tracking System for pfSense WiFi Manager
## Detailed Analysis & Recommendations

---

## 1. CODEBASE ANALYSIS

### Current Architecture Overview
- **Backend**: Node.js + Express with pfSense API v2 integration
- **Frontend**: Vue.js 3 with Vite
- **Deployment**: Docker Compose (two containers: backend + frontend)
- **Storage**: None currently - reads from pfSense directly
- **Key Services**: 
  - `pfsense.js` - Core pfSense API integration
  - Routes: `/clients`, `/stats`, `/blocked`, `/groups`

### Tracked Operations
The application already performs these operations that need event logging:
1. **Block/Unblock** - `blockIdentifier()`, `unblockIdentifier()` in pfsense.js
2. **Group Management** - `addMemberToAlias()`, `removeMemberFromAlias()`
3. **Client Connections** - Detected via DHCP leases polling (getConnectedClients)

### Current Data Flow
```
Frontend -> Express Routes -> pfSense Service -> pfSense API
                                    |
                              (No logging layer)
```

---

## 2. STORAGE OPTIONS COMPARISON

### Option A: File-Based JSON Logs (RECOMMENDED)
**Storage**: `/app/data/events.jsonl` in backend container with volume mount

**Pros**:
- Simple implementation (no external dependencies)
- Fast read/write for JSON operations
- Easy to rotate logs (by date/size)
- Easily parseable and portable
- No schema/migration concerns
- Works with Docker volumes
- Can be backed up easily
- Suitable for small-to-medium deployments (<100K events)

**Cons**:
- File I/O synchronization (mitigated with buffering)
- Not ideal for very high frequency writes
- Memory loading for large files (mitigated with streaming)
- Query capabilities limited (mitigated with in-memory filtering)

**Best For**: This use case - event tracking in a home/SMB router environment

---

### Option B: pfSense Syslog Integration
**Storage**: pfSense's built-in syslog facilities

**Pros**:
- Data stays in pfSense
- System is familiar with syslog
- Can be centralized to external syslog server

**Cons**:
- Limited control over log format
- Hard to structure JSON events
- pfSense already has syslog for system events (noise)
- Difficult to query and filter from our API
- Would need to parse pfSense logs back
- Not designed for structured event tracking

**Best For**: System-level logging only

---

### Option C: pfSense Alias Description Fields
**Storage**: Store events in alias `descr` (description) fields

**Example**:
```json
{
  "name": "BLOCKED",
  "address": ["192.168.1.100", "192.168.1.101"],
  "descr": "Blocked devices | Blocked 192.168.1.100 at 2024-11-01T10:30:00Z by system | Blocked 192.168.1.101 at 2024-11-01T10:45:00Z by system"
}
```

**Pros**:
- Data stays in pfSense
- Technically no external storage needed

**Cons**:
- Limited space (pfSense alias descriptions have limits)
- Unstructured data
- No query capabilities
- Difficult to parse reliably
- Not scalable (alias sizes would grow)
- Bad for performance (parsing on every query)
- Maintainability nightmare
- Would corrupt alias metadata

**Best For**: Not recommended

---

### Option D: SQLite Database
**Storage**: `/app/data/events.db` in backend container

**Pros**:
- Powerful query capabilities
- Structured data
- Efficient storage
- ACID transactions

**Cons**:
- Additional dependency (sqlite3 npm package)
- Requires schema management
- Migration complexity
- Not significantly easier than JSON for this use case
- More memory overhead

**Best For**: High-frequency event tracking (>1000 events/day)

---

## RECOMMENDATION: **Option A - File-Based JSON Logs**

Reasoning:
- Simplicity: No new dependencies, just file I/O
- Sufficient for residential/SMB WiFi manager
- Easy to implement and maintain
- Natural JSON structure matches application
- Easy to backup and migrate
- Minimal performance overhead
- Can implement log rotation and pagination easily

---

## 3. EVENT DATA STRUCTURE

### Event Schema
```javascript
{
  "id": "evt_1733059800000_0",              // Unique ID: evt_{timestamp}_{counter}
  "timestamp": "2024-11-01T10:30:00Z",      // ISO 8601 UTC
  "type": "DEVICE_BLOCKED",                 // Event type (enum)
  "severity": "info",                       // info, warning, error
  "source": "API",                          // API, SYSTEM, SCHEDULED
  "device": {
    "identifier": "192.168.1.100",          // IP, MAC, or hostname
    "identifierType": "ip",                 // ip, mac, hostname, alias
    "hostname": "john-phone",               // Resolved hostname if available
    "mac": "aa:bb:cc:dd:ee:ff",             // MAC if available
    "ip": "192.168.1.100"                   // IP if available
  },
  "action": {
    "name": "blocked",                      // blocked, unblocked, added, removed
    "targetName": null,                     // Group name if action on group
    "targetType": "device"                  // device, group
  },
  "result": {
    "success": true,
    "message": "Device successfully blocked"
  },
  "metadata": {
    "blockReason": "",                      // Optional reason for blocking
    "userId": "system",                     // Who performed the action
    "groupName": null                       // If part of group operation
  }
}
```

### Event Types (Enum)
```javascript
const EventTypes = {
  // Device/Client Events
  DEVICE_CONNECTED: 'DEVICE_CONNECTED',
  DEVICE_DISCONNECTED: 'DEVICE_DISCONNECTED',
  DEVICE_BLOCKED: 'DEVICE_BLOCKED',
  DEVICE_UNBLOCKED: 'DEVICE_UNBLOCKED',
  
  // Group Events
  GROUP_CREATED: 'GROUP_CREATED',
  GROUP_DELETED: 'GROUP_DELETED',
  GROUP_MEMBER_ADDED: 'GROUP_MEMBER_ADDED',
  GROUP_MEMBER_REMOVED: 'GROUP_MEMBER_REMOVED',
  GROUP_BLOCKED: 'GROUP_BLOCKED',
  GROUP_UNBLOCKED: 'GROUP_UNBLOCKED',
  
  // System Events
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  SYSTEM_INFO: 'SYSTEM_INFO'
};
```

---

## 4. IMPLEMENTATION APPROACH

### Architecture Overview
```
Frontend
   |
   v
Express Routes (block, unblock, group ops)
   |
   +-----> EventLogger Service (new)
   |           |
   |           +-> File I/O (events.jsonl)
   |           +-> In-memory Cache
   |           +-> Log Rotation
   |
   +-----> pfSense Service
              |
              v
           pfSense API
```

### Core Components to Implement

#### 4.1 Event Logger Service
**File**: `backend/src/services/eventLogger.js`

Features:
- Log events to file (JSONL format)
- In-memory buffer for high-frequency writes
- Query/filter events with pagination
- Auto-rotate logs by date
- Cleanup old logs (configurable retention)

```javascript
class EventLogger {
  constructor(logsDir = '/app/data/logs') {
    this.logsDir = logsDir;
    this.currentFile = this.getLogPath();
    this.buffer = [];
    this.flushInterval = 5000; // 5 sec
    this.maxBufferSize = 100;
    this.startFlushInterval();
  }

  log(event) {
    // Validate event structure
    // Add to buffer
    // Auto-flush if buffer full
  }

  query(filters) {
    // Load relevant log files
    // Filter by type, date, device, etc.
    // Return paginated results
  }

  getEvents(options = {}) {
    // Simple interface for fetching events
    // Supports: limit, offset, type, startDate, endDate, device
  }
}
```

#### 4.2 Connection Tracking Service
**File**: `backend/src/services/connectionTracker.js`

Purpose: Detect device connections/disconnections by polling DHCP leases

```javascript
class ConnectionTracker {
  constructor(pfsense, eventLogger, pollInterval = 60000) {
    this.pfsense = pfsense;
    this.eventLogger = eventLogger;
    this.pollInterval = pollInterval;
    this.previousClients = new Map();
    this.start();
  }

  async poll() {
    const currentClients = await this.pfsense.getConnectedClients();
    
    // Compare with previous snapshot
    const currentMacs = new Set(currentClients.map(c => c.mac));
    const previousMacs = new Set(this.previousClients.keys());
    
    // Detect new connections
    for (const client of currentClients) {
      if (!previousMacs.has(client.mac)) {
        this.eventLogger.log({
          type: 'DEVICE_CONNECTED',
          device: {
            mac: client.mac,
            ip: client.ip,
            hostname: client.hostname
          }
        });
      }
    }
    
    // Detect disconnections
    for (const mac of previousMacs) {
      if (!currentMacs.has(mac)) {
        this.eventLogger.log({
          type: 'DEVICE_DISCONNECTED',
          device: { mac }
        });
      }
    }
    
    this.previousClients = new Map(
      currentClients.map(c => [c.mac, c])
    );
  }
}
```

#### 4.3 Event Logging Middleware
**File**: `backend/src/middleware/eventLogger.js`

Purpose: Intercept block/unblock/group operations and log them

```javascript
const eventLoggerMiddleware = (eventLogger) => {
  return {
    // Wrap route handlers to capture operations
    logBlockAction: (req, res, next) => {
      const originalJson = res.json.bind(res);
      
      res.json = function(data) {
        if (data.success) {
          eventLogger.log({
            type: 'DEVICE_BLOCKED',
            device: { identifier: req.params.identifier },
            result: { success: true }
          });
        }
        return originalJson(data);
      };
      
      next();
    }
  };
};
```

---

## 5. IMPLEMENTATION DETAILS

### 5.1 File Storage Format (JSONL)
**Rationale**: JSON Lines - one JSON object per line

**Benefits**:
- Streamable (don't need to load entire file into memory)
- Easy to append
- Easy to grep/search
- Each line is independent
- Flexible for streaming queries

**File Organization**:
```
/app/data/logs/
├── events-2024-11-01.jsonl
├── events-2024-10-31.jsonl
├── events-2024-10-30.jsonl
└── ...
```

**Rotation Strategy**:
- Daily rotation at midnight UTC
- Keep last 90 days (configurable)
- Compress old logs if needed

### 5.2 In-Memory Buffer Strategy
**Goal**: Reduce disk I/O for high-frequency events

**Implementation**:
- Buffer events in memory array
- Flush to disk every 5 seconds OR when buffer reaches 100 events
- On graceful shutdown, flush remaining events
- For reads, merge in-memory buffer with disk logs

### 5.3 Query Implementation
**Strategy**: For small deployments, stream from JSONL files

```javascript
async getEvents(options = {}) {
  const {
    limit = 100,
    offset = 0,
    type,
    startDate,
    endDate,
    deviceId,
    deviceType
  } = options;

  const results = [];
  const startMs = startDate?.getTime() || 0;
  const endMs = endDate?.getTime() || Date.now();
  
  // Stream through relevant log files
  // Filter in-memory
  // Apply pagination
  // Return results
}
```

**Complexity**: O(n) for now, acceptable for small deployments
**Future**: Add SQLite if >10K events/day

### 5.4 Connection Detection Strategy
**Method**: Poll-based (simpler than event-driven in this architecture)

**Polling Interval**: 
- Default: 60 seconds (balance between real-time and API load)
- Configurable: `CONNECTION_POLL_INTERVAL` env var
- Starts on backend initialization

**Detection Logic**:
- Compare current DHCP leases with previous snapshot
- New MACs = connections
- Missing MACs = disconnections
- Account for lease transitions

### 5.5 Block/Unblock Action Logging
**Integration Points**:

1. **In Routes** (Simplest):
   ```javascript
   // In blocked.js route
   router.post('/:identifier/block', async (req, res) => {
     const { identifier } = req.params;
     const result = await pfsense.blockIdentifier(identifier);
     
     // Log the action
     if (result.success) {
       eventLogger.log({
         type: 'DEVICE_BLOCKED',
         device: { identifier },
         action: { name: 'blocked', targetType: result.type }
       });
     }
     
     res.json(result);
   });
   ```

2. **In Service** (Cleaner separation):
   ```javascript
   // In pfsense.js
   async blockIdentifier(identifier) {
     // ... existing block logic ...
     const result = await pfsenseAPI.block();
     
     // Emit event
     this.emit('block', { identifier, result });
     
     return result;
   }
   ```

   Then routes listen to service events.

**Recommendation**: Approach #1 (in routes) for simplicity - easier to test and understand the flow.

---

## 6. HISTORY VIEW UI

### Data Requirements
```javascript
GET /api/events?limit=50&offset=0&type=DEVICE_BLOCKED&startDate=2024-11-01

Response: {
  success: true,
  data: {
    events: [...],
    total: 342,
    hasMore: true
  }
}
```

### UI Features

#### 6.1 Real-Time vs Paginated
**Recommendation**: Paginated with real-time updates via polling

**Implementation**:
- Initial load: Paginated results (50 per page)
- Auto-refresh: Poll `/api/events` every 30 seconds
- New events appear in real-time at top of list
- Users can scroll through historical events

**Rationale**: 
- Simpler than WebSockets
- Reuses existing polling pattern
- Works well with Vue reactivity
- Minimal server load

#### 6.2 Filters
```javascript
// UI State
const filters = {
  eventType: null,        // null = all, or specific type
  deviceId: null,         // Filter by IP/MAC/hostname
  dateRange: {
    start: null,          // Date picker
    end: null
  },
  actionType: null        // blocked, unblocked, connected, etc.
};

// Query string:
// /api/events?type=DEVICE_BLOCKED&device=192.168.1.100&startDate=2024-11-01T00:00:00Z
```

#### 6.3 History Retention
**Configuration**: 
- Default: 90 days of history
- Configurable: `EVENT_RETENTION_DAYS` env var
- Older events auto-deleted
- Can be imported/exported before deletion

**Rationale for 90 days**:
- Covers seasonal patterns (3 months of school, work, etc.)
- ~30KB per 1000 events, ~900KB for 90 days of heavy use
- Negligible storage impact
- Good for audit trail

---

## 7. DETAILED IMPLEMENTATION ROADMAP

### Phase 1: Core Event Logger (Week 1)
- [ ] Create `EventLogger` service with file I/O
- [ ] Implement JSONL persistence
- [ ] Add in-memory buffering
- [ ] Add log rotation by date
- [ ] Implement query/filter methods
- [ ] Add retention cleanup

### Phase 2: Block/Unblock Logging (Week 1-2)
- [ ] Update `/api/blocked/:identifier/block` route
- [ ] Update `/api/blocked/:identifier/unblock` route
- [ ] Update group routes (add/remove members)
- [ ] Test logging with each operation

### Phase 3: Connection Tracking (Week 2)
- [ ] Create `ConnectionTracker` service
- [ ] Implement polling mechanism
- [ ] Detect connections/disconnections
- [ ] Log to EventLogger
- [ ] Configure polling interval

### Phase 4: History API (Week 2-3)
- [ ] Create `/api/events` GET endpoint
- [ ] Implement filtering
- [ ] Implement pagination
- [ ] Add date range support
- [ ] Performance testing with large logs

### Phase 5: Frontend History View (Week 3-4)
- [ ] Create `HistoryView.vue` component
- [ ] Implement event type filter dropdown
- [ ] Implement device search
- [ ] Implement date range picker
- [ ] Add real-time polling for new events
- [ ] Add pagination controls
- [ ] Responsive design for mobile

### Phase 6: Testing & Polish (Week 4)
- [ ] Unit tests for EventLogger
- [ ] Integration tests for routes
- [ ] UI testing
- [ ] Performance testing
- [ ] Documentation

---

## 8. CODE EXAMPLES

### 8.1 EventLogger Service
```javascript
// backend/src/services/eventLogger.js

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class EventLogger extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logsDir = config.logsDir || '/app/data/logs';
    this.flushInterval = config.flushInterval || 5000;
    this.maxBufferSize = config.maxBufferSize || 100;
    this.retentionDays = config.retentionDays || 90;
    this.buffer = [];
    this.eventCounter = 0;
    this.currentDate = this.getFormattedDate();
    
    this.initialize();
  }

  async initialize() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
      this.startFlushInterval();
      this.startRetentionCleanup();
      console.log(`EventLogger initialized at ${this.logsDir}`);
    } catch (error) {
      console.error('EventLogger initialization error:', error);
    }
  }

  log(event) {
    const timestamp = new Date().toISOString();
    const id = `evt_${Date.now()}_${this.eventCounter++}`;
    
    const enrichedEvent = {
      id,
      timestamp,
      ...event,
      severity: event.severity || 'info',
      source: event.source || 'API'
    };

    this.buffer.push(enrichedEvent);
    this.emit('event', enrichedEvent);

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush().catch(err => console.error('Flush error:', err));
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0);
    const logFile = this.getLogPath();

    try {
      const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(logFile, lines);
      // console.log(`Flushed ${events.length} events`);
    } catch (error) {
      console.error('Error flushing events:', error);
      // Re-add events to buffer on error
      this.buffer.unshift(...events);
    }
  }

  startFlushInterval() {
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => console.error('Flush error:', err));
    }, this.flushInterval);
  }

  startRetentionCleanup() {
    // Run cleanup daily
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(err => console.error('Cleanup error:', err));
    }, 24 * 60 * 60 * 1000);
    
    // Run once on startup
    this.cleanup().catch(err => console.error('Cleanup error:', err));
  }

  async cleanup() {
    try {
      const files = await fs.readdir(this.logsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      for (const file of files) {
        if (!file.startsWith('events-') || !file.endsWith('.jsonl')) continue;

        const fileDate = new Date(file.replace('events-', '').replace('.jsonl', ''));
        if (fileDate < cutoffDate) {
          await fs.unlink(path.join(this.logsDir, file));
          console.log(`Cleaned up old log: ${file}`);
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  async getEvents(options = {}) {
    const {
      limit = 50,
      offset = 0,
      type,
      startDate,
      endDate,
      device,
      action
    } = options;

    const startMs = startDate ? new Date(startDate).getTime() : 0;
    const endMs = endDate ? new Date(endDate).getTime() : Date.now();

    const results = [];
    let count = 0;

    try {
      const files = (await fs.readdir(this.logsDir))
        .filter(f => f.startsWith('events-') && f.endsWith('.jsonl'))
        .sort()
        .reverse();

      for (const file of files) {
        const filePath = path.join(this.logsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n').reverse();

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = JSON.parse(line);
          const eventTime = new Date(event.timestamp).getTime();

          // Filter by date range
          if (eventTime < startMs || eventTime > endMs) continue;

          // Filter by type
          if (type && event.type !== type) continue;

          // Filter by device
          if (device) {
            const deviceMatch = 
              event.device?.identifier === device ||
              event.device?.mac === device ||
              event.device?.ip === device ||
              event.device?.hostname === device;
            if (!deviceMatch) continue;
          }

          // Filter by action
          if (action && event.action?.name !== action) continue;

          // Apply pagination
          if (count >= offset && results.length < limit) {
            results.push(event);
          }
          count++;

          if (results.length >= limit) break;
        }

        if (results.length >= limit) break;
      }

      return {
        success: true,
        data: {
          events: results,
          total: count,
          limit,
          offset,
          hasMore: count > (offset + limit)
        }
      };
    } catch (error) {
      console.error('Error getting events:', error);
      return {
        success: false,
        error: error.message,
        data: { events: [], total: 0 }
      };
    }
  }

  getLogPath() {
    const date = this.getFormattedDate();
    return path.join(this.logsDir, `events-${date}.jsonl`);
  }

  getFormattedDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  async close() {
    clearInterval(this.flushTimer);
    clearInterval(this.cleanupTimer);
    await this.flush();
  }
}

module.exports = EventLogger;
```

### 8.2 Integration in Backend Entry Point
```javascript
// backend/src/index.js

const EventLogger = require('./services/eventLogger');
const ConnectionTracker = require('./services/connectionTracker');

// ... existing code ...

// Initialize event logger
const eventLogger = new EventLogger({
  logsDir: process.env.LOGS_DIR || '/app/data/logs',
  retentionDays: parseInt(process.env.EVENT_RETENTION_DAYS) || 90
});

// Initialize connection tracker
const connectionTracker = new ConnectionTracker(pfsense, eventLogger, {
  pollInterval: parseInt(process.env.CONNECTION_POLL_INTERVAL) || 60000
});

// Add events endpoint
app.use('/api/events', authenticate, (req, res) => {
  const { limit, offset, type, startDate, endDate, device, action } = req.query;
  
  eventLogger.getEvents({
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    type,
    startDate,
    endDate,
    device,
    action
  })
  .then(result => res.json(result))
  .catch(error => res.status(500).json({ success: false, error: error.message }));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await connectionTracker.stop();
  await eventLogger.close();
  process.exit(0);
});
```

### 8.3 Updated Blocked Route with Logging
```javascript
// backend/src/routes/blocked.js

const express = require('express');
const router = express.Router();
const pfsense = require('../services/pfsense');

// eventLogger is passed via middleware
router.use((req, res, next) => {
  req.eventLogger = require('../services/eventLogger').getInstance();
  next();
});

router.post('/:identifier/block', async (req, res) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({ 
        success: false, 
        error: 'Identifier is required' 
      });
    }

    const result = await pfsense.blockIdentifier(
      decodeURIComponent(identifier)
    );

    // Log the action
    if (result.success) {
      req.eventLogger.log({
        type: 'DEVICE_BLOCKED',
        device: {
          identifier: decodeURIComponent(identifier),
          identifierType: result.type || 'ip'
        },
        action: {
          name: 'blocked',
          targetType: result.type === 'alias' ? 'group' : 'device'
        },
        result: { success: true, message: result.message },
        metadata: { userId: 'system' }
      });
    }

    res.json(result);
  } catch (error) {
    // Log error
    if (req.eventLogger) {
      req.eventLogger.log({
        type: 'SYSTEM_ERROR',
        severity: 'error',
        action: { name: 'block_failed' },
        result: { success: false, message: error.message }
      });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// Similar for unblock, add member, remove member...
```

### 8.4 Frontend History View
```vue
<!-- frontend/src/views/HistoryView.vue -->

<template>
  <div class="history-view">
    <div class="header">
      <h1>Event History</h1>
      <p class="subtitle">Track all activities and changes</p>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <label>Event Type</label>
        <select v-model="filters.type">
          <option value="">All Events</option>
          <option value="DEVICE_BLOCKED">Device Blocked</option>
          <option value="DEVICE_UNBLOCKED">Device Unblocked</option>
          <option value="DEVICE_CONNECTED">Device Connected</option>
          <option value="DEVICE_DISCONNECTED">Device Disconnected</option>
          <option value="GROUP_MEMBER_ADDED">Member Added</option>
          <option value="GROUP_MEMBER_REMOVED">Member Removed</option>
        </select>
      </div>

      <div class="filter-group">
        <label>Device/Hostname</label>
        <input 
          v-model="filters.device" 
          type="text" 
          placeholder="Search by IP, MAC, or hostname"
        />
      </div>

      <div class="filter-group">
        <label>From Date</label>
        <input 
          v-model="filters.startDate" 
          type="date"
        />
      </div>

      <div class="filter-group">
        <label>To Date</label>
        <input 
          v-model="filters.endDate" 
          type="date"
        />
      </div>

      <button @click="applyFilters" class="btn btn-primary">
        Apply Filters
      </button>
      <button @click="resetFilters" class="btn btn-secondary">
        Reset
      </button>
    </div>

    <!-- Events Table/List -->
    <div class="events-container">
      <div v-if="loading" class="loading">
        <p>Loading events...</p>
      </div>

      <div v-else-if="events.length === 0" class="no-events">
        <p>No events found</p>
      </div>

      <div v-else class="events-list">
        <div v-for="event in events" :key="event.id" class="event-card">
          <div class="event-header">
            <span class="event-type" :class="`type-${event.type.toLowerCase()}`">
              {{ formatEventType(event.type) }}
            </span>
            <span class="event-time">
              {{ formatTime(event.timestamp) }}
            </span>
          </div>

          <div class="event-body">
            <p class="event-message">
              {{ getEventMessage(event) }}
            </p>
            <div v-if="event.device" class="event-device">
              <span v-if="event.device.hostname" class="device-hostname">
                {{ event.device.hostname }}
              </span>
              <span v-if="event.device.ip" class="device-ip">
                {{ event.device.ip }}
              </span>
              <span v-if="event.device.mac" class="device-mac">
                {{ event.device.mac }}
              </span>
            </div>
          </div>

          <div class="event-footer">
            <span v-if="event.result?.success" class="success-badge">
              Success
            </span>
            <span v-else class="error-badge">
              Failed
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="hasMore || offset > 0" class="pagination">
      <button 
        @click="previousPage" 
        :disabled="offset === 0"
        class="btn btn-secondary"
      >
        Previous
      </button>
      <span class="page-info">
        Page {{ currentPage }} (showing {{ events.length }} / {{ total }} events)
      </span>
      <button 
        @click="nextPage" 
        :disabled="!hasMore"
        class="btn btn-secondary"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { apiCall } from '../api/client';

const events = ref([]);
const loading = ref(false);
const total = ref(0);
const hasMore = ref(false);
const currentPage = ref(1);
const limit = 50;
const offset = ref(0);

const filters = reactive({
  type: '',
  device: '',
  startDate: '',
  endDate: '',
  action: ''
});

let pollInterval;

const fetchEvents = async () => {
  loading.value = true;
  try {
    const queryParams = new URLSearchParams({
      limit,
      offset: offset.value,
      ...(filters.type && { type: filters.type }),
      ...(filters.device && { device: filters.device }),
      ...(filters.startDate && { startDate: new Date(filters.startDate).toISOString() }),
      ...(filters.endDate && { endDate: new Date(filters.endDate).toISOString() })
    });

    const response = await apiCall(`/api/events?${queryParams}`);
    if (response.success) {
      events.value = response.data.events;
      total.value = response.data.total;
      hasMore.value = response.data.hasMore;
      currentPage.value = Math.floor(offset.value / limit) + 1;
    }
  } catch (error) {
    console.error('Error fetching events:', error);
  } finally {
    loading.value = false;
  }
};

const applyFilters = () => {
  offset.value = 0;
  fetchEvents();
};

const resetFilters = () => {
  filters.type = '';
  filters.device = '';
  filters.startDate = '';
  filters.endDate = '';
  offset.value = 0;
  fetchEvents();
};

const nextPage = () => {
  offset.value += limit;
  fetchEvents();
};

const previousPage = () => {
  offset.value = Math.max(0, offset.value - limit);
  fetchEvents();
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const formatEventType = (type) => {
  return type.replace(/_/g, ' ').toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const getEventMessage = (event) => {
  const actionName = event.action?.name || 'unknown';
  const deviceIdentifier = event.device?.hostname || 
                           event.device?.ip || 
                           event.device?.identifier || 
                           'Unknown device';

  if (event.type === 'DEVICE_BLOCKED') {
    return `Device "${deviceIdentifier}" was blocked`;
  } else if (event.type === 'DEVICE_UNBLOCKED') {
    return `Device "${deviceIdentifier}" was unblocked`;
  } else if (event.type === 'DEVICE_CONNECTED') {
    return `Device "${deviceIdentifier}" connected to network`;
  } else if (event.type === 'DEVICE_DISCONNECTED') {
    return `Device "${deviceIdentifier}" disconnected from network`;
  } else if (event.type === 'GROUP_MEMBER_ADDED') {
    return `"${deviceIdentifier}" was added to group "${event.metadata?.groupName}"`;
  } else if (event.type === 'GROUP_MEMBER_REMOVED') {
    return `"${deviceIdentifier}" was removed from group "${event.metadata?.groupName}"`;
  }
  
  return event.result?.message || 'Unknown event';
};

onMounted(() => {
  fetchEvents();
  
  // Auto-refresh every 30 seconds
  pollInterval = setInterval(() => {
    fetchEvents();
  }, 30000);
});

onUnmounted(() => {
  clearInterval(pollInterval);
});
</script>

<style scoped>
.history-view {
  padding: 1rem;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  margin: 0;
}

.subtitle {
  color: #666;
  margin: 0.5rem 0 0;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  flex-direction: column;
}

.filter-group label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.filter-group input,
.filter-group select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.event-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.event-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #fafafa;
  border-bottom: 1px solid #e0e0e0;
}

.event-type {
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
}

.type-device-blocked {
  background: #ffebee;
  color: #c62828;
}

.type-device-unblocked {
  background: #e8f5e9;
  color: #2e7d32;
}

.type-device-connected {
  background: #e3f2fd;
  color: #1565c0;
}

.type-device-disconnected {
  background: #fff3e0;
  color: #e65100;
}

.event-time {
  color: #666;
  font-size: 0.9rem;
}

.event-body {
  padding: 1rem;
}

.event-message {
  margin: 0 0 0.5rem;
  color: #333;
}

.event-device {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.device-hostname,
.device-ip,
.device-mac {
  background: #f5f5f5;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.event-footer {
  padding: 0.5rem 1rem;
  background: #fafafa;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
}

.success-badge {
  color: #2e7d32;
  font-weight: 600;
  font-size: 0.85rem;
}

.error-badge {
  color: #c62828;
  font-weight: 600;
  font-size: 0.85rem;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding: 1rem;
}

.page-info {
  color: #666;
}

.loading,
.no-events {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #1976d2;
  color: white;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

@media (max-width: 768px) {
  .filters {
    grid-template-columns: 1fr;
  }

  .event-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
```

---

## 9. ENVIRONMENT VARIABLES

Add to `.env`:
```env
# Event Logging Configuration
LOGS_DIR=/app/data/logs
EVENT_RETENTION_DAYS=90
CONNECTION_POLL_INTERVAL=60000
```

Add to `docker-compose.yml`:
```yaml
volumes:
  - ./backend:/app
  - /app/node_modules
  - ./backend/data:/app/data  # Add this line
```

---

## 10. DATABASE MIGRATION PATH

If you outgrow file-based storage (>1000 events/day):

1. **Introduce SQLite** alongside JSONL
2. **Run daily batch job** to import JSONL to SQLite
3. **Migrate reads** gradually to SQLite
4. **Archive old JSONL** files

This hybrid approach maintains backward compatibility while improving scalability.

---

## 11. TESTING STRATEGY

### Unit Tests
- EventLogger: Write, read, filter, rotate
- ConnectionTracker: Detect changes
- Event creation: Correct schema

### Integration Tests
- Block action logs correctly
- Unblock action logs correctly
- Group member operations log
- Connection/disconnection detected

### Load Tests
- 1000 events/day: Verify pagination performance
- 10 concurrent users: Verify API response time
- Large date range queries: Verify streaming efficiency

---

## 12. MONITORING & ALERTS

### Metrics to Track
- Events logged per day
- Log file sizes
- Query performance (>500ms = slow)
- Error events logged
- Oldest retained event

### Health Check Addition
```javascript
app.get('/api/events/health', (req, res) => {
  const stats = eventLogger.getStats();
  res.json({
    status: stats.errorsInLast24Hours === 0 ? 'ok' : 'degraded',
    totalEvents: stats.totalEvents,
    logsSize: stats.dirSize,
    oldestEvent: stats.oldestEvent
  });
});
```

---

## SUMMARY & RECOMMENDATIONS

### Go with File-Based JSON Logs (JSONL) because:
1. **Simplicity**: No database setup, no migrations
2. **Portability**: Easy backup, easy to move between systems
3. **Performance**: Sufficient for home/SMB router (100-500 events/day)
4. **Scalability**: Easy to migrate to SQLite when/if needed
5. **Transparency**: Logs are human-readable, easily inspectable
6. **Docker-friendly**: Works with volume mounts, no special containers

### Implementation Priority:
1. EventLogger service (foundation)
2. Block/unblock logging (most important actions)
3. Connection tracking (nice to have)
4. History API (UI enabler)
5. Frontend History View (user-facing)

### Timeline: 2-3 weeks of development
- Week 1: EventLogger + Block/unblock logging
- Week 2: Connection tracking + History API
- Week 3: Frontend UI + Testing

### Risk Mitigation:
- Start with block/unblock logging only
- Add connection tracking after validating performance
- Monitor log file sizes weekly
- Keep 90-day history initially, adjust based on growth

---

