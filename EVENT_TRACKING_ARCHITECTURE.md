# Event Tracking System - Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vue.js 3)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ DashboardView    BlockedClientsView    HistoryView (NEW)  │ │
│  │     |                   |                    |             │ │
│  │     └───────────────────┴────────────────────┘             │ │
│  │              All routes use API calls                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           |                                      │
│                    HTTP/REST API calls                           │
│                           |                                      │
└─────────────────────────────────────────────────────────────────┘
                             |
        ┌────────────────────┼────────────────────┐
        |                    |                    |
        v                    v                    v
   /api/clients         /api/blocked         /api/events (NEW)
   /api/stats           /api/groups
   
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Express Router Layer                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ clients.js   │  │ blocked.js   │  │ events.js    │   │  │
│  │  │ (routes)     │  │ (routes)     │  │ (NEW routes) │   │  │
│  │  │ + logging    │  │ + logging    │  │              │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │         |                   |              |            │  │
│  │         └───────────────────┴──────────────┘            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Service Layer (Business Logic)                 │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  pfsense.js (pfSense API Integration)             │ │  │
│  │  │  - blockIdentifier()                              │ │  │
│  │  │  - unblockIdentifier()                            │ │  │
│  │  │  - addMemberToAlias()                             │ │  │
│  │  │  - removeMemberFromAlias()                        │ │  │
│  │  │  - getConnectedClients()                          │ │  │
│  │  │  - getDHCPLeases()                                │ │  │
│  │  │  - getAliases()                                   │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                          ^                             │  │
│  │                          | (calls)                     │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  EventLogger (NEW - Event Logging Service)        │ │  │
│  │  │  - log(event)         -> Buffer + Flush          │ │  │
│  │  │  - getEvents()        -> Query & Filter          │ │  │
│  │  │  - flush()            -> Write to disk           │ │  │
│  │  │  - cleanup()          -> Retention management    │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  ConnectionTracker (NEW - Connection Tracking)    │ │  │
│  │  │  - poll()             -> Compare DHCP snapshots   │ │  │
│  │  │  - detectChanges()    -> Identify conn/disconn   │ │  │
│  │  │  - logConnections()   -> Emit to EventLogger     │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                          |                             │  │
│  │                          | (logs events)              │  │
│  └──────────────────────────┼───────────────────────────┘  │
│                             |                               │
│  ┌──────────────────────────v───────────────────────────┐  │
│  │              Storage Layer (NEW)                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  EventLogger (JSONL Writer)                   │ │  │
│  │  │  - In-memory buffer (100 events max)          │ │  │
│  │  │  - Flush interval (5 seconds)                 │ │  │
│  │  │  - Daily log rotation                         │ │  │
│  │  │  - Automatic cleanup (90 days retention)      │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────┬───────────────────────────┘  │
│                             |                               │
└─────────────────────────────┼───────────────────────────────┘
                              |
                              v
                    /app/data/logs/ (NEW)
                         |
        ┌────────────────┴────────────────┐
        |                                 |
        v                                 v
   events-2024-11-01.jsonl   events-2024-10-31.jsonl
   events-2024-10-30.jsonl   ...
   (JSONL format - one JSON object per line)


EXTERNAL SYSTEMS
        |
        v
    pfSense Router
        |
    ├── DHCP Server (leases)
    ├── ARP Table
    ├── Firewall Aliases
    └── API v2
```

## Data Flow Diagrams

### Block/Unblock Operation Flow

```
User Action
    |
    v
Frontend: "Block Device" button
    |
    v
POST /api/blocked/192.168.1.100/block
    |
    v
Backend Route Handler (blocked.js)
    |
    ├─→ pfsense.blockIdentifier('192.168.1.100')
    |   └─→ pfSense API: Update BLOCKED alias
    |       └─→ Apply firewall changes
    |
    └─→ eventLogger.log({
        type: 'DEVICE_BLOCKED',
        device: { identifier: '192.168.1.100' },
        ...
    })
        |
        v
    Buffer in memory
        |
        └─→ Auto-flush when buffer >= 100 events
            OR every 5 seconds
            |
            v
        Append to /app/data/logs/events-YYYY-MM-DD.jsonl
            |
            v
        Return response to Frontend
```

### Connection Detection Flow

```
Every 60 seconds (polling interval)
    |
    v
ConnectionTracker.poll()
    |
    v
Compare current DHCP leases with previous snapshot
    |
    ├─→ NEW MACs detected
    |   └─→ eventLogger.log({
    |       type: 'DEVICE_CONNECTED',
    |       device: { mac, ip, hostname }
    |   })
    |
    └─→ MISSING MACs detected
        └─→ eventLogger.log({
            type: 'DEVICE_DISCONNECTED',
            device: { mac }
        })
    |
    v
Buffer → Flush to disk → Events file
```

### Event Query Flow

```
User: Filter history by date + type
    |
    v
Frontend: Apply filters
    |
    v
GET /api/events?type=DEVICE_BLOCKED&startDate=2024-11-01&limit=50&offset=0
    |
    v
Backend: eventLogger.getEvents({...})
    |
    ├─→ Read relevant log files (based on date range)
    |   (e.g., events-2024-11-01.jsonl, events-2024-10-31.jsonl)
    |
    ├─→ Stream lines from files
    |
    ├─→ Parse JSON objects
    |
    ├─→ Filter by:
    |   - Event type
    |   - Device identifier
    |   - Date range
    |   - Action type
    |
    ├─→ Apply pagination (limit, offset)
    |
    └─→ Return results
        {
          events: [...],
          total: 342,
          hasMore: true
        }
    |
    v
Frontend: Display paginated results
    |
    └─→ Auto-refresh every 30 seconds for new events
```

## Event Lifecycle

```
EVENT CREATION
    |
    v
Route handler calls eventLogger.log(event)
    |
    v
Event enriched with:
    - Unique ID (evt_{timestamp}_{counter})
    - Timestamp (ISO 8601 UTC)
    - Severity (info/warning/error)
    - Source (API/SYSTEM/SCHEDULED)
    |
    v
Stored in in-memory buffer
    |
    v
FLUSH DECISION
    |
    ├─→ Buffer size >= 100 events?  → FLUSH
    |
    └─→ 5 seconds elapsed?          → FLUSH
        |
        v
    DISK WRITE
        |
        v
    Append to JSONL file
    (events-{YYYY-MM-DD}.jsonl)
        |
        v
    File persists across restarts
    |
    v
QUERY PHASE
    |
    v
    User queries history
    |
    v
    Backend reads JSONL files
    |
    v
    Streams, filters, paginates
    |
    v
    Returns to frontend
    |
    v
RETENTION PHASE
    |
    v
    Daily cleanup job (runs at backend startup + once/day)
    |
    v
    Check log file dates
    |
    v
    If file older than 90 days
        |
        v
        Delete file
```

## Component Interactions

### Services
```
EventLogger
  ├── Dependencies: fs (file system)
  ├── Exposes:
  │   ├── log(event)          -> Adds to buffer
  │   ├── getEvents(filters)  -> Queries from disk
  │   ├── flush()             -> Writes to disk
  │   └── cleanup()           -> Removes old files
  └── Emits: 'event' on new log

ConnectionTracker
  ├── Dependencies: PfSenseService, EventLogger
  ├── Exposes:
  │   ├── poll()              -> Check for changes
  │   ├── start()             -> Begin polling
  │   └── stop()              -> Stop polling
  └── Emits: Events to EventLogger

PfSenseService (existing, no changes needed)
  ├── blockIdentifier()
  ├── unblockIdentifier()
  ├── getConnectedClients()
  └── ...
```

### Routes
```
blocked.js routes
  │
  ├── POST /:identifier/block
  │   └── Logs: DEVICE_BLOCKED or error
  │
  ├── POST /:identifier/unblock
  │   └── Logs: DEVICE_UNBLOCKED or error
  │
  └── GET /
      └── Returns enriched blocked items

groups.js routes
  │
  ├── POST /:name/members
  │   └── Logs: GROUP_MEMBER_ADDED
  │
  ├── DELETE /:name/members/:member
  │   └── Logs: GROUP_MEMBER_REMOVED
  │
  └── ... (other group ops)

events.js routes (NEW)
  │
  └── GET /
      └── eventLogger.getEvents(query params)
          └── Returns paginated events
```

## Data Persistence Strategy

```
Docker Container Restart
    |
    └─→ Volume mounts preserved
        |
        v
    /app/data/logs/ persists across restarts
        |
        v
    Old events still available
    |
    └─→ New connections/blocks logged to new day's file
```

## Performance Characteristics

```
Write Path (Block/Unblock)
┌──────────────────────────────────────┐
│ User clicks block                    │
├──────────────────────────────────────┤
│ API call: ~50ms                      │
│ pfSense block: ~500ms                │
│ Event logging: ~0.1ms (buffered)     │
├──────────────────────────────────────┤
│ Total: ~550ms                        │
└──────────────────────────────────────┘

Read Path (Query History)
┌──────────────────────────────────────┐
│ User filters history                 │
├──────────────────────────────────────┤
│ Disk read (streaming): ~20ms         │
│ JSON parsing (50 events): ~30ms      │
│ Filtering + pagination: ~20ms        │
├──────────────────────────────────────┤
│ Total: ~70ms (for 50 events)         │
└──────────────────────────────────────┘

Memory Usage
┌──────────────────────────────────────┐
│ Event buffer (100 events): ~50KB     │
│ JSONL parsing (streaming): ~10KB     │
│ In-flight requests: ~20KB            │
├──────────────────────────────────────┤
│ Total baseline: ~80KB                │
│ Peak with queries: ~5MB              │
└──────────────────────────────────────┘

Disk Usage
┌──────────────────────────────────────┐
│ Average event size: 300 bytes        │
│ Per 1000 events: ~300KB              │
│ Per day (500 events): ~150KB         │
│ Per 90 days: ~13.5MB                 │
├──────────────────────────────────────┤
│ Typical: <100MB for heavy use        │
└──────────────────────────────────────┘
```

## Scalability Considerations

### Current Design (File-based JSONL)
- Suitable for: 10-1000 events/day (typical home/SMB router)
- Max realistic: ~5000 events/day before slowdown
- Query time: O(n) linear scan of files

### Optimization Points
1. **Compression**: Gzip old logs (saves 90% disk space)
2. **Indexing**: Create daily index file (faster queries)
3. **SQLite**: Migrate to SQLite for >5000 events/day
4. **Sharding**: Split logs by event type (faster filtering)

### Migration to SQLite (Future)
```
1. Current: JSONL files
           ↓
2. Phase 1: JSONL + SQLite (dual write)
           ↓
3. Phase 2: SQLite primary (JSONL archived)
           ↓
4. Phase 3: SQLite only (JSONL deleted after 30 days)
```

---

## Summary

This architecture provides:

1. **Simplicity**: No external services, just file I/O
2. **Reliability**: Volume mounts ensure data persistence
3. **Performance**: In-memory buffering + async flushes
4. **Scalability**: Easy migration path to database
5. **Observability**: Human-readable JSONL logs
6. **Maintainability**: Clear separation of concerns

The system is designed to be implemented incrementally, with each phase building on the previous one, allowing for validation before moving forward.
