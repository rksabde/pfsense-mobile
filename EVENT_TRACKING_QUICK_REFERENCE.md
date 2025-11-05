# Event Tracking System - Quick Reference Guide

## Executive Summary

Implement a file-based event tracking system using JSONL (JSON Lines) format with the following features:

- **Storage**: `/app/data/logs/events-YYYY-MM-DD.jsonl` (daily rotation)
- **Performance**: In-memory buffering (flush every 5s or 100 events)
- **Query**: Streaming JSONL parser with filtering/pagination
- **Retention**: 90 days configurable cleanup
- **Events**: Block/unblock, connect/disconnect, group operations

## Quick Decision Matrix

| Requirement | Solution |
|-----------|----------|
| Storage Method | File-based JSONL (no external DB) |
| Event Types | 9 core types (DEVICE_BLOCKED, etc.) |
| Update Frequency | Real-time logging + 30s polling |
| History Duration | 90 days (configurable) |
| Query Performance | O(n) streaming (acceptable for <1000 events/day) |
| UI Approach | Paginated (50 per page) + polling (30s refresh) |
| WebSockets | No (polling simpler for this scale) |

## File Structure Changes

```
backend/
├── src/
│   ├── services/
│   │   ├── eventLogger.js          (NEW)
│   │   ├── connectionTracker.js    (NEW)
│   │   └── pfsense.js
│   ├── routes/
│   │   ├── events.js               (NEW)
│   │   ├── blocked.js              (MODIFIED - add logging)
│   │   ├── groups.js               (MODIFIED - add logging)
│   │   └── ...
│   └── index.js                    (MODIFIED - init services)
└── data/
    └── logs/                       (NEW - Docker volume mount)

frontend/
└── src/
    └── views/
        └── HistoryView.vue         (NEW)
```

## Event Types (Complete List)

```javascript
DEVICE_BLOCKED              // Device IP/MAC blocked
DEVICE_UNBLOCKED            // Device IP/MAC unblocked
DEVICE_CONNECTED            // Device connected to network
DEVICE_DISCONNECTED         // Device disconnected from network
GROUP_CREATED               // Alias/group created
GROUP_DELETED               // Alias/group deleted
GROUP_MEMBER_ADDED          // Device added to group
GROUP_MEMBER_REMOVED        // Device removed from group
GROUP_BLOCKED               // Entire group blocked
GROUP_UNBLOCKED             // Entire group unblocked
SYSTEM_ERROR                // System error occurred
```

## Environment Variables to Add

```env
# Event Logging
LOGS_DIR=/app/data/logs
EVENT_RETENTION_DAYS=90
CONNECTION_POLL_INTERVAL=60000

# Optional
LOG_LEVEL=info
```

## Docker Compose Update

Add volume for logs:
```yaml
services:
  backend:
    volumes:
      - ./backend:/app
      - /app/node_modules
      - ./backend/data:/app/data  # NEW - persistent logs
```

## Implementation Checklist

### Phase 1: EventLogger Service (2-3 days)
- [ ] Create `eventLogger.js` with:
  - JSONL file writing
  - In-memory buffer with flush
  - Daily log rotation
  - Retention cleanup
  - Query/filter methods
  - Pagination support

### Phase 2: Logging Integration (2-3 days)
- [ ] Update `/api/blocked/:id/block` route
- [ ] Update `/api/blocked/:id/unblock` route
- [ ] Update group member routes
- [ ] Manually test each operation

### Phase 3: Connection Tracking (1-2 days)
- [ ] Create `connectionTracker.js`
- [ ] Implement polling loop
- [ ] Compare DHCP snapshots
- [ ] Log connect/disconnect events

### Phase 4: Events API (1-2 days)
- [ ] Create `/api/events` GET endpoint
- [ ] Implement query filtering
- [ ] Add pagination
- [ ] Performance test with 1000+ events

### Phase 5: Frontend (3-4 days)
- [ ] Create `HistoryView.vue`
- [ ] Filters: type, device, date range
- [ ] Pagination controls
- [ ] Auto-refresh polling
- [ ] Mobile responsive design

### Phase 6: Testing (1-2 days)
- [ ] Unit tests for EventLogger
- [ ] Integration tests
- [ ] Load testing (1000+ events)
- [ ] UI acceptance testing

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Log write latency | <5ms | Buffered, async |
| Query latency (50 events) | <100ms | Streaming JSONL |
| Memory overhead | <50MB | Buffer + in-memory cache |
| Disk usage (90 days) | ~1GB | ~11MB per 1000 events |
| API response time | <500ms | Even with filters |

## Deployment Steps

1. Create directory structure
2. Deploy code changes
3. Restart backend (volume mounts apply)
4. Test block/unblock operations (should log)
5. Wait 60s for first connection event
6. Access History view in UI
7. Verify events appear

## Key Code Snippets

### Log an event
```javascript
eventLogger.log({
  type: 'DEVICE_BLOCKED',
  device: { identifier: '192.168.1.100', ip: '192.168.1.100' },
  action: { name: 'blocked', targetType: 'device' },
  result: { success: true }
});
```

### Query events
```javascript
const result = await eventLogger.getEvents({
  limit: 50,
  offset: 0,
  type: 'DEVICE_BLOCKED',
  startDate: '2024-11-01T00:00:00Z'
});
```

### API endpoint
```javascript
GET /api/events?type=DEVICE_BLOCKED&device=192.168.1.100&limit=50&offset=0
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Events not logging | Check directory permissions on `/app/data/logs` |
| Connection events missing | Verify polling interval and DHCP available |
| Slow queries | Check log file sizes, consider pagination limit |
| Disk space growing | Verify retention cleanup running (daily) |
| Events lost on restart | Check volume mounts in docker-compose.yml |

## Migration Path (Future)

If grows beyond 1000 events/day:
1. Add SQLite alongside JSONL
2. Batch import JSONL to SQLite daily
3. Migrate read queries to SQLite
4. Archive old JSONL files

## References

- JSONL Format: https://jsonlines.org/
- Polling vs WebSockets: https://en.wikipedia.org/wiki/Polling_(computer_science)
- Log Rotation: https://en.wikipedia.org/wiki/Log_rotation

---

## Next Steps

1. Review EventLogger.js code (see section 8.1 of full analysis)
2. Implement Phase 1 (EventLogger service)
3. Test with manual block/unblock operations
4. Proceed to remaining phases

**Estimated Total Effort**: 2-3 weeks (10-15 hours development + testing)
