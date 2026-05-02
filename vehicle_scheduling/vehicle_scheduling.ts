import axios from 'axios';

const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJ2YWlzaG5hdmkzQGdtYWlsLmNvbSIsImV4cCI6MTc3NzcwNjQ4OCwiaWF0IjoxNzc3NzA1NTg4LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiNjlmMTA5Y2MtOTBiZS00YzJkLTkyZWItZjdlOTBiYWRkMjU3IiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoidmFpc2huYXZpIGFtYW5jaGFybGEiLCJzdWIiOiI0NGYxNjY4Yi03ZTk5LTQ5OGUtYTE3YS0yOWNiMGNlZGNmZjIifSwiZW1haWwiOiJ2YWlzaG5hdmkzQGdtYWlsLmNvbSIsIm5hbWUiOiJ2YWlzaG5hdmkgYW1hbmNoYXJsYSIsInJvbGxObyI6InJhMjMxMTAwMzAxMTcyMyIsImFjY2Vzc0NvZGUiOiJRa2JweEgiLCJjbGllbnRJRCI6IjQ0ZjE2NjhiLTdlOTktNDk4ZS1hMTdhLTI5Y2IwY2VkY2ZmMiIsImNsaWVudFNlY3JldCI6InJQeVJCZ3h2d2hldVRnengifQ.fk-aInq_XwabZSjdRqfnetMIpvHvvRXiVFmuEuOWIxM';

const BASE_URL = 'http://20.207.122.201/evaluation-service';

const headers = { Authorization: `Bearer ${ACCESS_TOKEN}` };

interface Depot {
  ID: string;
  MechanicHours: number;
}

interface Vehicle {
  TaskID: string;
  Duration: number;
  Impact: number;
}

interface KnapsackResult {
  selected: Vehicle[];
  totalDuration: number;
  totalImpact: number;
}

function knapsack(vehicles: Vehicle[], capacity: number): KnapsackResult {
  const n = vehicles.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    const v = vehicles[i - 1];
    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w];
      if (v.Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - v.Duration] + v.Impact);
      }
    }
  }

  const selected: Vehicle[] = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(vehicles[i - 1]);
      w -= vehicles[i - 1].Duration;
    }
  }

  const totalDuration = selected.reduce((sum, v) => sum + v.Duration, 0);
  const totalImpact = selected.reduce((sum, v) => sum + v.Impact, 0);

  return { selected, totalDuration, totalImpact };
}

async function main() {
  try {
    console.log('Fetching depots...');
    const depotsRes = await axios.get(`${BASE_URL}/depots`, { headers });
    const depots: Depot[] = depotsRes.data.depots;
    console.log(`Found ${depots.length} depots`);

    console.log('Fetching vehicles...');
    const vehiclesRes = await axios.get(`${BASE_URL}/vehicles`, { headers });
    const vehicles: Vehicle[] = vehiclesRes.data.vehicles;
    console.log(`Found ${vehicles.length} vehicles`);

    console.log('\n========== VEHICLE MAINTENANCE SCHEDULER ==========\n');

    for (const depot of depots) {
      console.log(`Depot ${depot.ID} | Budget: ${depot.MechanicHours} hours`);
      console.log('---------------------------------------------------');

      const result = knapsack(vehicles, depot.MechanicHours);

      console.log(`Selected: ${result.selected.length} vehicles | Total Duration: ${result.totalDuration}h | Total Impact: ${result.totalImpact}`);
      console.log('Vehicles selected:');
      result.selected.forEach((v, i) =>
        console.log(`  ${i + 1}. TaskID: ${v.TaskID} | Duration: ${v.Duration}h | Impact: ${v.Impact}`)
      );
      console.log('');
    }

    console.log('========== DONE ==========');
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();