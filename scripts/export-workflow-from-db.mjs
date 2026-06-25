import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const root = path.resolve(import.meta.dirname, '..');
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const outDir = path.join(root, 'workflows');
const outPath = path.join(outDir, 'n8n_하루건강약사_수동실행.json');
const workflowId = process.env.N8N_WORKFLOW_ID || 'mxrYb3maJS31gEYC';

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  return JSON.parse(value);
}

function readWorkflow() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (openError) => {
      if (openError) reject(openError);
    });

    db.get(
      'select name, nodes, connections, settings, staticData, pinData, versionId, triggerCount from workflow_entity where id = ?',
      [workflowId],
      (error, row) => {
        db.close();
        if (error) {
          reject(error);
          return;
        }
        if (!row) {
          reject(new Error(`Workflow not found: ${workflowId}`));
          return;
        }
        resolve({ id: workflowId, ...row });
      },
    );
  });
}

const row = await readWorkflow();
const workflow = {
  id: row.id,
  name: row.name,
  nodes: parseJson(row.nodes, []),
  connections: parseJson(row.connections, {}),
  settings: parseJson(row.settings, {}),
  staticData: parseJson(row.staticData, null),
  pinData: parseJson(row.pinData, {}),
  versionId: row.versionId,
  triggerCount: row.triggerCount,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  ok: true,
  workflow: workflow.name,
  nodes: workflow.nodes.length,
  output: outPath,
}, null, 2));
