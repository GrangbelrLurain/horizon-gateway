import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

const options = {
  date: new Date().toISOString().split('T')[0],
  host: null,
  method: null,
  path: null,
  status: null,
  search: null,
  limit: 5,
  fields: 'id,timestamp,method,host,path,status_code',
  truncate: 200,
  id: null,
  summary: false,
};

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--date' && args[i + 1]) options.date = args[++i];
  else if (arg === '--host' && args[i + 1]) options.host = args[++i];
  else if (arg === '--method' && args[i + 1]) options.method = args[++i].toUpperCase();
  else if (arg === '--path' && args[i + 1]) options.path = args[++i];
  else if (arg === '--status' && args[i + 1]) options.status = args[++i];
  else if (arg === '--search' && args[i + 1]) options.search = args[++i];
  else if (arg === '--limit' && args[i + 1]) options.limit = parseInt(args[++i], 10);
  else if (arg === '--fields' && args[i + 1]) options.fields = args[++i];
  else if (arg === '--truncate' && args[i + 1]) options.truncate = parseInt(args[++i], 10);
  else if (arg === '--id' && args[i + 1]) options.id = args[++i];
  else if (arg === '--summary') options.summary = true;
}

function getWatchtowerLogsDir() {
  const appId = 'com.lurain.watchtower';
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) return null;
    return path.join(appData, appId, 'api_logs');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appId, 'api_logs');
  }
  const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(xdgData, appId, 'api_logs');
}

const logsDir = getWatchtowerLogsDir();
if (!logsDir) {
  console.error(JSON.stringify({ error: 'Could not resolve Watchtower app data directory.' }, null, 2));
  process.exit(1);
}

const logFile = path.join(logsDir, `${options.date}.jsonl`);

if (!fs.existsSync(logFile)) {
  console.error(JSON.stringify({ error: `Log file for date ${options.date} not found at ${logFile}` }, null, 2));
  process.exit(1);
}

const requestedFields = options.fields.split(',').map((f) => f.trim());
const fileStream = fs.createReadStream(logFile);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity,
});

const matchedLogs = [];
let totalScanned = 0;
const summaryStats = {
  totalMatches: 0,
  methods: {},
  statusCodes: {},
  hosts: {},
};

rl.on('line', (line) => {
  if (!line.trim()) return;
  totalScanned++;

  try {
    const entry = JSON.parse(line);

    if (options.id) {
      if (entry.id === options.id) {
        matchedLogs.push(entry);
        rl.close();
      }
      return;
    }

    if (options.host) {
      const entryHost = entry.host || '';
      if (!entryHost.toLowerCase().includes(options.host.toLowerCase())) return;
    }

    if (options.method && entry.method !== options.method) return;

    if (options.path) {
      const entryPath = entry.path || '';
      if (!entryPath.toLowerCase().includes(options.path.toLowerCase())) return;
    }

    if (options.status) {
      const entryStatus = String(entry.status_code || '');
      if (options.status.endsWith('xx')) {
        if (entryStatus[0] !== options.status[0]) return;
      } else if (entryStatus !== options.status) {
        return;
      }
    }

    if (options.search) {
      const reqBody = entry.request_body || '';
      const resBody = entry.response_body || '';
      const searchStr = options.search.toLowerCase();
      if (!reqBody.toLowerCase().includes(searchStr) && !resBody.toLowerCase().includes(searchStr)) {
        return;
      }
    }

    if (options.summary) {
      summaryStats.totalMatches++;
      summaryStats.methods[entry.method] = (summaryStats.methods[entry.method] || 0) + 1;
      summaryStats.statusCodes[entry.status_code] = (summaryStats.statusCodes[entry.status_code] || 0) + 1;
      summaryStats.hosts[entry.host] = (summaryStats.hosts[entry.host] || 0) + 1;
    } else {
      matchedLogs.push(entry);
    }
  } catch {
    // Ignore malformed JSON lines
  }
});

rl.on('close', () => {
  if (options.summary) {
    console.log(
      JSON.stringify(
        {
          date: options.date,
          totalScanned,
          summary: summaryStats,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const slicedLogs = options.id ? matchedLogs : matchedLogs.slice(-options.limit).reverse();

  const projectedLogs = slicedLogs.map((entry) => {
    const projected = {};
    for (const field of requestedFields) {
      if (!(field in entry)) continue;

      let val = entry[field];
      if ((field === 'request_body' || field === 'response_body') && typeof val === 'string') {
        if (val.length > options.truncate) {
          val =
            val.substring(0, options.truncate) +
            `... (truncated, total ${val.length} chars. Use --truncate to get more)`;
        }
      }
      projected[field] = val;
    }
    return projected;
  });

  console.log(
    JSON.stringify(
      {
        date: options.date,
        limit: options.limit,
        resultsCount: projectedLogs.length,
        totalMatchingCount: options.id ? projectedLogs.length : matchedLogs.length,
        logs: projectedLogs,
      },
      null,
      2,
    ),
  );
});
