param(
  [string]$Workflow = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
if (-not $Workflow) {
  $Workflow = Get-ChildItem -LiteralPath (Join-Path $Root "workflows") -Filter "*.json" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not (Test-Path -LiteralPath $Workflow)) {
  throw "Workflow file not found: $Workflow"
}

$env:N8N_USER_FOLDER = $Root
Set-Location $Root

& "$Root\node_modules\.bin\n8n.cmd" import:workflow --input $Workflow
