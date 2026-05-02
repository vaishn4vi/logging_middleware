import axios from 'axios';

const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJ2YWlzaG5hdmkzQGdtYWlsLmNvbSIsImV4cCI6MTc3NzcwNzQ4MiwiaWF0IjoxNzc3NzA2NTgyLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiZWNhYzdjZTItMGY0My00OWQ5LWIyMTUtMjRlYTBiMmZjMDIwIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoidmFpc2huYXZpIGFtYW5jaGFybGEiLCJzdWIiOiI0NGYxNjY4Yi03ZTk5LTQ5OGUtYTE3YS0yOWNiMGNlZGNmZjIifSwiZW1haWwiOiJ2YWlzaG5hdmkzQGdtYWlsLmNvbSIsIm5hbWUiOiJ2YWlzaG5hdmkgYW1hbmNoYXJsYSIsInJvbGxObyI6InJhMjMxMTAwMzAxMTcyMyIsImFjY2Vzc0NvZGUiOiJRa2JweEgiLCJjbGllbnRJRCI6IjQ0ZjE2NjhiLTdlOTktNDk4ZS1hMTdhLTI5Y2IwY2VkY2ZmMiIsImNsaWVudFNlY3JldCI6InJQeVJCZ3h2d2hldVRnengifQ.w7CCL7lLcOCj7cruWQfl8T7dASZrqV8zdzGd3mQOWBs';

const BASE_URL = 'http://20.207.122.201/evaluation-service';

const headers = { Authorization: `Bearer ${ACCESS_TOKEN}` };

interface Notification {
  ID: string;
  Type: string;
  Message: string;
  Timestamp: string;
}

interface ScoredNotification extends Notification {
  priorityScore: number;
}

function getTypePriority(type: string): number {
  const priorities: { [key: string]: number } = {
    Placement: 3,
    Result: 2,
    Event: 1,
    General: 0,
  };
  return priorities[type] ?? 0;
}

function getRecencyScore(timestamp: string): number {
  if (!timestamp) return 0;
  const now = new Date().getTime();
  const then = new Date(timestamp).getTime();
  const minutesAgo = (now - then) / 60000;
  return Math.max(0, 1000 - minutesAgo);
}

function scoreNotification(n: Notification): ScoredNotification {
  const typePriority = getTypePriority(n.Type);
  const recency = getRecencyScore(n.Timestamp);
  const priorityScore = typePriority * 1000 + recency;
  return { ...n, priorityScore };
}

async function main() {
  try {
    console.log('Fetching notifications...');
    const res = await axios.get(`${BASE_URL}/notifications`, { headers });

    const raw: Notification[] = res.data.notifications;
    console.log(`Total notifications fetched: ${raw.length}`);

    const scored = raw.map(scoreNotification);
    scored.sort((a, b) => b.priorityScore - a.priorityScore);

    const top10 = scored.slice(0, 10);

    console.log('\n========== TOP 10 PRIORITY NOTIFICATIONS ==========\n');
    top10.forEach((n, i) => {
      console.log(`${i + 1}. [${n.Type}] Score: ${n.priorityScore.toFixed(2)}`);
      console.log(`   ID: ${n.ID}`);
      console.log(`   Message: ${n.Message}`);
      console.log(`   Timestamp: ${n.Timestamp}`);
      console.log('');
    });

    console.log('========== DONE ==========');
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();