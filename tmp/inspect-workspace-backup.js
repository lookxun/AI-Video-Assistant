const fs = require("fs");

const p = ".runtime/migration-backups/2026-06-06T18-48-45-483Z-user-workspaces.json";
const data = JSON.parse(fs.readFileSync(p, "utf8"));
const rows = Array.isArray(data) ? data : Object.values(data);

for (const row of rows) {
  const userId = row.userId || row.user_id || row.id;
  const state = row.state || row.workspaceState || row;
  if (userId === "ID_636611" || JSON.stringify(row).includes("ID_636611")) {
    console.log(JSON.stringify({
      keys: Object.keys(row),
      userId,
      assets: Array.isArray(state.assets) ? state.assets.length : null,
      sessions: Array.isArray(state.sessions) ? state.sessions.length : null,
      stateBytes: Buffer.byteLength(JSON.stringify(state)),
      firstAssets: Array.isArray(state.assets) ? state.assets.slice(0, 5).map((asset) => ({ id: asset.id, name: asset.name, type: asset.type, url: asset.url })) : [],
    }, null, 2));
  }
}
