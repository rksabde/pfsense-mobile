# Event Tracking System - Complete Documentation

## Quick Navigation

This directory contains comprehensive analysis and recommendations for implementing an event tracking system for the pfSense WiFi Manager.

### Documents (Read in This Order)

1. **EVENT_TRACKING_SUMMARY.md** (Start Here - 5 min read)
   - Executive summary of the recommendation
   - High-level overview of the approach
   - Key benefits and timeline
   - Next steps

2. **EVENT_TRACKING_QUICK_REFERENCE.md** (Reference - 5 min read)
   - Decision matrix
   - File structure changes
   - Environment variables
   - Implementation checklist
   - Troubleshooting guide

3. **EVENT_TRACKING_ARCHITECTURE.md** (Deep Dive - 15 min read)
   - System architecture diagrams
   - Data flow diagrams
   - Component interactions
   - Performance characteristics
   - Scalability considerations

4. **EVENT_TRACKING_ANALYSIS.md** (Complete Analysis - 30 min read)
   - Codebase analysis
   - Storage options comparison
   - Event data structure
   - Implementation approach details
   - Complete code examples
   - Testing strategy

---

## The Recommendation in 30 Seconds

Implement **file-based JSONL event logging** with:
- EventLogger service: Logs to `/app/data/logs/events-YYYY-MM-DD.jsonl`
- In-memory buffering: Flush every 5 seconds or 100 events
- ConnectionTracker service: Polls DHCP leases to detect connections
- Simple API endpoint: `/api/events` with filtering/pagination
- Frontend history view: Queryable, paginated event list

**Why**: Simplest implementation, no external dependencies, sufficient for your scale (100-1000 events/day), easy to migrate to database later.

**Timeline**: 2-3 weeks of development

---

## File Structure

### New Files to Create
```
backend/
├── src/
│   ├── services/
│   │   ├── eventLogger.js          (350 lines - see section 8.1 in analysis)
│   │   └── connectionTracker.js    (200 lines - new service)
│   ├── routes/
│   │   └── events.js               (50 lines - new endpoint)
│   └── index.js                    (MODIFY - init services)
└── data/
    ├── logs/                       (created at runtime)
    └── .gitkeep

frontend/
└── src/
    └── views/
        └── HistoryView.vue         (400 lines - new view)
```

### Files to Modify
- `backend/src/routes/blocked.js` - Add event logging
- `backend/src/routes/groups.js` - Add event logging
- `backend/docker-compose.yml` - Add volume mount for data/logs
- `.env` - Add event logging config vars

---

## Event Types

The system tracks these 11 event types:

**Device Events:**
- `DEVICE_BLOCKED` - Device blocked
- `DEVICE_UNBLOCKED` - Device unblocked
- `DEVICE_CONNECTED` - Device connected to network
- `DEVICE_DISCONNECTED` - Device disconnected

**Group Events:**
- `GROUP_CREATED` - Alias created
- `GROUP_DELETED` - Alias deleted
- `GROUP_MEMBER_ADDED` - Device added to group
- `GROUP_MEMBER_REMOVED` - Device removed from group
- `GROUP_BLOCKED` - Group blocked
- `GROUP_UNBLOCKED` - Group unblocked

**System Events:**
- `SYSTEM_ERROR` - System error occurred

---

## Sample Event

```json
{
  "id": "evt_1733059800000_0",
  "timestamp": "2024-11-01T10:30:00.000Z",
  "type": "DEVICE_BLOCKED",
  "severity": "info",
  "source": "API",
  "device": {
    "identifier": "192.168.1.100",
    "identifierType": "ip",
    "hostname": "john-phone",
    "mac": "aa:bb:cc:dd:ee:ff",
    "ip": "192.168.1.100"
  },
  "action": {
    "name": "blocked",
    "targetType": "device"
  },
  "result": {
    "success": true,
    "message": "Device successfully blocked"
  },
  "metadata": {
    "userId": "system"
  }
}
```

---

## API Endpoints

### Query Events
```
GET /api/events?type=DEVICE_BLOCKED&device=192.168.1.100&limit=50&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [...],
    "total": 342,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Configuration

### Environment Variables
```env
# Event Logging
LOGS_DIR=/app/data/logs
EVENT_RETENTION_DAYS=90
CONNECTION_POLL_INTERVAL=60000
```

### Docker Compose
```yaml
services:
  backend:
    volumes:
      - ./backend:/app
      - /app/node_modules
      - ./backend/data:/app/data  # ADD THIS
```

---

## Implementation Phases

### Phase 1: Core EventLogger (2 days)
- [ ] Create eventLogger.js service
- [ ] Implement JSONL writing
- [ ] Add buffering and flushing
- [ ] Test file I/O

### Phase 2: Integration (2 days)
- [ ] Modify blocked.js routes
- [ ] Modify groups.js routes
- [ ] Test block/unblock logging
- [ ] Test group member logging

### Phase 3: Connection Tracking (1 day)
- [ ] Create connectionTracker.js
- [ ] Implement DHCP polling
- [ ] Test connection detection

### Phase 4: Events API (1 day)
- [ ] Create events.js endpoint
- [ ] Implement filtering
- [ ] Test queries

### Phase 5: Frontend (2 days)
- [ ] Create HistoryView.vue
- [ ] Add filters and pagination
- [ ] Test UI

### Phase 6: Testing (1-2 days)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Load testing

**Total: 2-3 weeks**

---

## Performance Profile

| Metric | Value | Notes |
|--------|-------|-------|
| Write latency | <1ms | Buffered, async |
| Query time (50 events) | ~70ms | Streaming JSONL |
| Memory overhead | <80KB | Baseline |
| Disk usage (90 days) | ~13MB | At 500 events/day |
| Max sustainable rate | ~5000 events/day | Before slowdown |

---

## Key Code Snippets

### Log an Event
```javascript
eventLogger.log({
  type: 'DEVICE_BLOCKED',
  device: { identifier: '192.168.1.100', ip: '192.168.1.100' },
  action: { name: 'blocked', targetType: 'device' },
  result: { success: true }
});
```

### Query Events
```javascript
const result = await eventLogger.getEvents({
  limit: 50,
  offset: 0,
  type: 'DEVICE_BLOCKED',
  startDate: '2024-11-01T00:00:00Z'
});
```

### In Route Handler
```javascript
router.post('/:identifier/block', async (req, res) => {
  const result = await pfsense.blockIdentifier(req.params.identifier);
  
  if (result.success) {
    eventLogger.log({
      type: 'DEVICE_BLOCKED',
      device: { identifier: req.params.identifier },
      action: { name: 'blocked', targetType: 'device' },
      result: { success: true }
    });
  }
  
  res.json(result);
});
```

---

## Docker Volume Mount

The logs directory needs to persist across container restarts:

```yaml
services:
  backend:
    volumes:
      # Existing mounts
      - ./backend:/app
      - /app/node_modules
      
      # NEW: Add this for persistent logs
      - ./backend/data:/app/data
```

This creates `/app/data/logs/` inside the container, which maps to `./backend/data/logs/` on the host.

---

## File Storage Format

Events are stored in **JSONL** (JSON Lines) format:
- One JSON object per line
- Easily streamable (no need to load entire file)
- Daily rotation (events-YYYY-MM-DD.jsonl)
- Human-readable for debugging

Example:
```
{"id":"evt_1...","timestamp":"2024-11-01T10:30:00Z","type":"DEVICE_BLOCKED",...}
{"id":"evt_1...","timestamp":"2024-11-01T10:35:00Z","type":"DEVICE_UNBLOCKED",...}
{"id":"evt_1...","timestamp":"2024-11-01T10:40:00Z","type":"DEVICE_CONNECTED",...}
```

---

## Connection Detection

The `ConnectionTracker` service:
1. Polls DHCP leases every 60 seconds
2. Compares current vs previous snapshot
3. Detects new connections (new MACs)
4. Detects disconnections (missing MACs)
5. Logs to EventLogger

This is automatic - no user interaction needed.

---

## History View Features

The frontend history view provides:
- **Filtering**: By event type, device, date range
- **Pagination**: 50 events per page
- **Search**: Find by IP, MAC, or hostname
- **Auto-refresh**: Updates every 30 seconds
- **Mobile-responsive**: Works on phones/tablets
- **Status badges**: Success/failure indicators

---

## Storage Requirements

- Average event size: 300 bytes
- Daily (500 events): ~150KB
- Monthly: ~4.5MB
- 90-day retention: ~13.5MB
- Heavy use (1000/day): ~27MB for 90 days

**Conclusion**: Storage is negligible for your use case.

---

## Troubleshooting

### Events not persisting
- Check volume mount in docker-compose.yml
- Verify `/app/data/logs` directory created
- Check file permissions (should be writable by container)

### Slow queries
- Check log file sizes with `du -sh backend/data/logs/`
- Ensure pagination limit is set (default 50)
- Filter to specific date range when possible

### Missing connection events
- Verify DHCP is enabled on pfSense
- Check CONNECTION_POLL_INTERVAL is reasonable (60s default)
- Ensure pfSense API can access DHCP leases

### Old events not deleted
- Check EVENT_RETENTION_DAYS is set (default 90)
- Verify cleanup runs daily (logs at startup + 24h interval)
- Check disk space isn't full

---

## Migration Path (Future)

If you exceed 1000 events/day, migrate to SQLite:

1. Add SQLite alongside JSONL
2. Batch import daily JSONL to SQLite
3. Migrate read queries to SQLite
4. Archive old JSONL files

This is a non-breaking change - existing functionality continues to work.

---

## Testing Checklist

- [ ] Block a device, verify event logged
- [ ] Unblock a device, verify event logged
- [ ] Create a group, verify event logged
- [ ] Add member to group, verify event logged
- [ ] Remove member from group, verify event logged
- [ ] Query history via API with filters
- [ ] Load history view in frontend
- [ ] Paginate through events
- [ ] Auto-refresh shows new events
- [ ] Events persist after container restart

---

## Monitoring

Add these metrics to your monitoring:
- Total events logged (should increase steadily)
- Log directory size (should stay <100MB)
- API response times (should be <500ms)
- Connection polling health (should detect all changes)
- Event buffer utilization (should be <50%)

---

## Support

For detailed information on:
- **Storage decision**: See EVENT_TRACKING_ANALYSIS.md section 2
- **Event structure**: See EVENT_TRACKING_ANALYSIS.md section 3
- **Code examples**: See EVENT_TRACKING_ANALYSIS.md section 8
- **Architecture**: See EVENT_TRACKING_ARCHITECTURE.md
- **Quick decisions**: See EVENT_TRACKING_QUICK_REFERENCE.md

---

## Next Steps

1. Read EVENT_TRACKING_SUMMARY.md (5 min)
2. Review EVENT_TRACKING_QUICK_REFERENCE.md (5 min)
3. Examine code examples in EVENT_TRACKING_ANALYSIS.md (section 8)
4. Start Phase 1: Implement EventLogger service
5. Test with block/unblock operations
6. Proceed to remaining phases

**Estimated timeline**: 2-3 weeks from start to complete implementation.

---

## Questions?

Refer to the appropriate section:
- How much data will this store? → Performance Profile
- What if we outgrow this? → Migration Path
- How does it work? → Architecture Overview
- Show me the code → EVENT_TRACKING_ANALYSIS.md section 8
- Is this the best approach? → EVENT_TRACKING_ANALYSIS.md section 2

**Ready to start?** Begin with EventLogger.js implementation from EVENT_TRACKING_ANALYSIS.md section 8.1.
