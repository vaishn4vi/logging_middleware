# Campus Notification System Design
**Name:** Vaishnavi Amancharla | **Roll No:** RA2311003011723

---

## Stage 1: REST API Design

### POST /notifications — Send a notification
**Request:**
```json
{
  "type": "Placement",
  "title": "Google On-Campus Drive",
  "message": "Google will be visiting on May 10th. Register by May 5th.",
  "targetAudience": ["CSE", "IT"],
  "sentBy": "placement-cell",
  "timestamp": "2024-05-01T10:00:00Z"
}
```
**Response:**
```json
{
  "id": "notif_001",
  "status": "sent",
  "timestamp": "2024-05-01T10:00:00Z"
}
```

### GET /notifications — Fetch notifications for a user
**Request:** `GET /notifications?userID=student_123&page=1&limit=20`
**Response:**
```json
{
  "notifications": [
    {
      "id": "notif_001",
      "type": "Placement",
      "title": "Google On-Campus Drive",
      "message": "Google will be visiting on May 10th.",
      "read": false,
      "timestamp": "2024-05-01T10:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### PUT /notifications/:id/read — Mark as read
**Response:**
```json
{ "id": "notif_001", "read": true }
```

### Real-Time via WebSockets
- Client connects: `ws://server/notifications?userID=student_123`
- Server pushes new notifications instantly as JSON events
- Client acknowledges receipt to mark as delivered

---

## Stage 2: PostgreSQL Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- 'Placement', 'Result', 'Event', 'General'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  sent_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX idx_user_notifications_created_at ON user_notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
```

### Fetch unread notifications for a user:
```sql
SELECT n.id, n.type, n.title, n.message, n.created_at, un.read
FROM notifications n
JOIN user_notifications un ON n.id = un.notification_id
WHERE un.user_id = $1
  AND un.read = FALSE
ORDER BY n.created_at DESC
LIMIT 20;
```

### Problems at Scale
- Millions of rows in `user_notifications` → slow full table scans
- Fan-out problem: sending to 10,000 users creates 10,000 rows per notification
- Without indexes, ORDER BY created_at is extremely slow
- High read traffic during peak hours (exam results, placement drives)

---

## Stage 3: Query Optimization

### Slow Query (Before):
```sql
SELECT * FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC;
```
**Problems:** No index on user_id, SELECT * fetches unused columns, no LIMIT

### Fixed Query (After):
```sql
SELECT n.id, n.type, n.title, n.created_at
FROM notifications n
JOIN user_notifications un ON n.id = un.notification_id
WHERE un.user_id = $1
ORDER BY n.created_at DESC
LIMIT 20 OFFSET $2;
```
**Fixes applied:**
- Added composite index on (user_id, created_at DESC)
- SELECT only needed columns
- Added LIMIT + OFFSET for pagination
- JOIN instead of subquery

### Placement Notifications Query:
```sql
SELECT n.id, n.title, n.message, n.created_at
FROM notifications n
JOIN user_notifications un ON n.id = un.notification_id
WHERE un.user_id = $1
  AND n.type = 'Placement'
ORDER BY n.created_at DESC
LIMIT 10;
```

---

## Stage 4: Caching Strategy

### Redis Caching
- Cache each user's top 20 notifications: key = `notif:user:{userID}`
- TTL = 5 minutes
- On new notification → invalidate affected users' cache keys
- Cache hit ratio expected: ~85% for repeat reads

### WebSocket + Cache Together
- On WebSocket push → also invalidate Redis cache for that user
- Next API call gets fresh data, subsequent calls hit cache

### Pagination to Reduce Load
- Never fetch all notifications at once
- Use cursor-based pagination: `GET /notifications?after=timestamp`
- Reduces DB rows scanned per query from thousands to 20

### Write-Through Strategy
- On INSERT to notifications → write to DB + update Redis simultaneously
- Prevents cache stampede during high-traffic events like exam results

---

## Stage 5: Fix notify_all Pseudocode

### Original Problem (Broken):
```
function notify_all(message):
  users = db.get_all_users()
  for user in users:
    db.save_notification(user, message)  // blocks DB
    email.send(user.email, message)      // slow, synchronous
```
**Problems:** Synchronous loop blocks everything, email sending is slow,
DB gets hammered with N inserts, one failure crashes everything.

### Fixed Version Using Message Queue:
```
function notify_all(message):
  users = db.get_all_users()
  for user in users:
    queue.publish("notification_queue", {
      userID: user.id,
      message: message
    })

// Separate worker process:
queue.subscribe("notification_queue", function(job):
  db.save_notification(job.userID, job.message)
  email.send_async(job.userID, job.message)
)
```
**Fixes:**
- Queue (e.g. RabbitMQ / Redis Pub-Sub) decouples sending from processing
- Workers handle DB writes and emails independently
- Failed jobs are retried automatically
- Email sending is fully async and non-blocking
- DB load is spread over time instead of all at once

---

## Stage 6: Priority Inbox

### Priority Ranking Formula:
```
score = (typePriority × 1000) + recencyScore

typePriority:
  Placement = 3
  Result    = 2
  Event     = 1
  General   = 0

recencyScore = max(0, 1000 - minutesSincePosted)
```

### Example:
- Placement from 5 mins ago: 3×1000 + 995 = **3995**
- Result from 2 mins ago: 2×1000 + 998 = **2998**
- Event from 1 min ago: 1×1000 + 999 = **1999**

Placement always beats Result, Result always beats Event,
but a very recent Event can beat an old Result of the same tier.

### SQL for Priority Inbox:
```sql
SELECT n.id, n.type, n.title, n.created_at,
  CASE n.type
    WHEN 'Placement' THEN 3000
    WHEN 'Result' THEN 2000
    WHEN 'Event' THEN 1000
    ELSE 0
  END +
  GREATEST(0, 1000 - EXTRACT(EPOCH FROM (NOW() - n.created_at))/60)
  AS priority_score
FROM notifications n
JOIN user_notifications un ON n.id = un.notification_id
WHERE un.user_id = $1
ORDER BY priority_score DESC
LIMIT 10;
```