# n8n Local Runner Agent Notes

This repo is the deployable source for the user's local n8n video workflow runner.

Primary local path:

`C:\dev\n8n-local`

Local n8n URL:

`http://localhost:5678/`

GitHub repo:

`https://github.com/yeohj0710/n8n-local.git`

## Hard Rules

- Do not commit secrets, tokens, OAuth client secrets, API keys, `.n8n`, `node_modules`, `renders`, `binary-data`, logs, SQLite databases, or cache folders.
- Do not print or repeat secret values in final answers.
- Do not use `127.0.0.1:5678` for n8n OAuth work. Use `http://localhost:5678/`.
- Do not re-import an old workflow JSON over the local n8n DB unless intentionally resetting the user's node layout.
- Before editing workflow JSON, export/read the current workflow from the local DB first. The user manually adjusted node positions and does not want them moved back.
- If a workflow edit is needed, prefer patching the current DB-exported workflow, then import that exact file.
- Keep n8n Cloud and local n8n separate. Local render/upload depends on local paths and will not work in n8n Cloud without redesign.

## Important Paths

- Runner root: `C:\dev\n8n-local`
- n8n user folder / DB: `C:\dev\n8n-local\.n8n`
- n8n SQLite DB: `C:\dev\n8n-local\.n8n\database.sqlite`
- Render outputs: `C:\dev\n8n-local\renders`
- Binary storage: `C:\dev\n8n-local\binary-data`
- Startup script: `C:\dev\n8n-local\scripts\start-n8n.ps1`
- Hidden startup launcher: `C:\dev\n8n-local\scripts\start-n8n-hidden.vbs`
- Renderer script: `C:\dev\n8n-local\scripts\render-static-card.mjs`
- Workflow export script: `C:\dev\n8n-local\scripts\export-workflow-from-db.mjs`
- Workflow import script: `C:\dev\n8n-local\scripts\import-workflow.ps1`
- Repo workflow export: `C:\dev\n8n-local\workflows\n8n_하루건강약사_수동실행.json`
- Original Google Drive folder: `G:\내 드라이브\영상 편집\유튜브 닌자`

## Commands

Run from `C:\dev\n8n-local`.

```powershell
npm install
npm run start
npm run export:workflow
npm run import
git status --short --branch
```

Check local n8n is alive:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5678/rest/settings' -TimeoutSec 20
```

Restart local n8n without touching workflow layout:

```powershell
$procs = Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object {
    $_.CommandLine -like '*C:\dev\n8n-local\node_modules*\n8n*start*' -or
    $_.CommandLine -like '*C:\dev\n8n-local\node_modules\@n8n\task-runner*'
  }
$procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Process -FilePath 'wscript.exe' -ArgumentList '"C:\dev\n8n-local\scripts\start-n8n-hidden.vbs"' -WindowStyle Hidden
```

## Current Workflow Design

Workflow:

`하루건강약사 - 로컬 n8n 이미지+BGM 업로드`

Runtime path:

- Manual trigger
- Build rank pack
- KIE Claude text generation
- KIE image generation
- KIE BGM generation
- Local static-card MP4 render with ffmpeg
- Read generated MP4 from disk
- YouTube private upload
- Optional top-level YouTube comment

No TTS path should be used.

No Veo/video-generation path should be used.

No Creatomate path should be used.

The target channel style is static ranked-card Shorts: generate an image, overlay Korean ranking text, add BGM, render an MP4 locally.

## Credentials

Credentials are stored in the local n8n DB, not in git.

Expected local n8n credentials:

- `Header Auth account` for KIE API
- `YouTube account` for YouTube OAuth2 API

KIE uses Header Auth:

- Header name: `Authorization`
- Header value shape: `Bearer <KIE_API_KEY>`

YouTube OAuth redirect URI must be:

`http://localhost:5678/rest/oauth2-credential/callback`

If OAuth callback says `Unauthorized`, first check that the user opened local n8n through `localhost`, not `127.0.0.1`.

## Known Pitfalls And Fixes

### OAuth Callback Unauthorized

Cause:

The n8n editor was opened at `127.0.0.1`, but Google OAuth returned to `localhost`. Browser cookies/sessions do not match.

Fix:

- Use `http://localhost:5678/`
- Reopen credential page through `localhost`
- Save credential
- Click `Sign in with Google` again

### `process is not defined` In Code Node

Cause:

n8n Code nodes do not expose Node's `process` object.

Fix:

- Do not use `process.env` or `process.execPath` inside workflow Code nodes.
- Use fixed local paths from `Load Config`:
  - `C:/dev/n8n-local/renders`
  - `C:/dev/n8n-local/scripts/render-static-card.mjs`
  - `C:/Program Files/nodejs/node.exe`

### `Unrecognized node type: n8n-nodes-base.executeCommand`

Cause:

This n8n install did not recognize the Execute Command node.

Fix:

- Use a Code node named `Local FFmpeg Render`.
- Inside it, call `child_process.spawnSync`.
- Ensure `scripts/start-n8n.ps1` has:

```powershell
$env:NODE_FUNCTION_ALLOW_BUILTIN = "crypto,child_process"
```

### `Access to the file is not allowed`

Cause:

n8n file read nodes only allow configured file-access paths. Rendered MP4s are written to `C:\dev\n8n-local\renders`.

Fix:

`scripts/start-n8n.ps1` must include:

```powershell
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$DefaultFilesFolder;$RenderFolder"
```

Then restart local n8n.

### Workflow Node Positions Keep Moving

Cause:

Importing an older JSON rewrites workflow node positions and can undo the user's manual layout changes.

Fix:

- Export current DB workflow first with `npm run export:workflow`.
- Patch the exported JSON in `workflows\`.
- Import only after the user has saved their current layout, or after exporting the current DB.
- Never rerun old conversion scripts over the user's edited layout.

### BGM Pending Then Render Fails

Cause:

KIE BGM can still be `PENDING` after the first 30-second wait. If `bgm_audio_url` is still empty, `Prepare Local FFmpeg Render` must not run yet.

Fix:

- Keep `Parse BGM Result -> BGM Ready?`.
- If true, continue to `Use Live Render?`.
- If false, run `Wait BGM Retry 90s -> KIE Get BGM Task Retry -> Parse BGM Result Final`.
- `Parse BGM Result Final` should throw a BGM-specific error if URL is still missing, instead of letting render fail with missing `bgm_audio_url`.

### KIE `Unauthorized`

Cause:

Missing or malformed KIE Authorization header.

Fix:

- Confirm local n8n has `Header Auth account`.
- Header name must be `Authorization`.
- Header value must be `Bearer <key>`.
- Quick API credit checks are safe and do not generate paid media.

### KIE Image Policy Failure

Cause:

KIE image task can fail if prompt triggers upstream content policy.

Fix:

- Avoid medical claims, doctor impersonation, logos, fake authority, before/after, or cure/treatment wording in image prompts.
- Keep image prompt as a clean Korean Shorts ranking-card background with room for overlay text.

## Workflow QA Checklist

Run these before claiming the workflow source is healthy:

```powershell
node --check .\scripts\render-static-card.mjs
node --check .\scripts\export-workflow-from-db.mjs
```

Check workflow Code node syntax and known bad patterns:

```powershell
node -e "const fs=require('fs'); const wf=JSON.parse(fs.readFileSync('workflows/n8n_하루건강약사_수동실행.json','utf8')); const bad=[]; const processHits=[]; const executeCommandHits=[]; for(const n of wf.nodes){const c=n.parameters?.jsCode; if(c){try{new Function(c)}catch(e){bad.push({node:n.name,error:e.message})} if(c.includes('process.')) processHits.push(n.name);} if(String(n.type||'').includes('executeCommand')) executeCommandHits.push(n.name);} console.log(JSON.stringify({bad,processHits,executeCommandHits},null,2)); if(bad.length||processHits.length||executeCommandHits.length) process.exit(1);"
```

Expected:

- `bad` is empty
- `processHits` is empty
- `executeCommandHits` is empty

Check no obvious secrets are staged before pushing:

```powershell
git diff --cached --name-only
git diff --cached --stat
git status --short --ignored
```

## Git Rules

The repo intentionally tracks source and exported workflow only.

Commit these:

- `.gitignore`
- `AGENTS.md`
- `README.md`
- `package.json`
- `package-lock.json`
- `scripts/export-workflow-from-db.mjs`
- `scripts/import-workflow.ps1`
- `scripts/render-static-card.mjs`
- `scripts/start-n8n.ps1`
- `scripts/start-n8n-hidden.vbs`
- `workflows/n8n_하루건강약사_수동실행.json`

Do not commit:

- `.n8n/`
- `.cache/`
- `node_modules/`
- `renders/`
- `binary-data/`
- `logs/`
- any `*secret*`, `*credential*`, or `*.sqlite*`

## User Preference

- Keep answers terse and direct.
- Do not create duplicate workflow files unless explicitly asked.
- Fix the existing workflow/source in place.
- Do not move nodes far apart or overwrite manual layout.
- If a browser workflow is involved, tell the user exactly what to click next.
