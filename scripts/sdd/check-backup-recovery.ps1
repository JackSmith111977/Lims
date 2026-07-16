[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$docPath = Join-Path $root 'docs/ops/backup-recovery.md'
$designPath = Join-Path $root 'specs/001-lims-core/design-backup-recovery.md'
$errors = [System.Collections.Generic.List[string]]::new()

if (-not (Test-Path -LiteralPath $docPath -PathType Leaf)) { [void]$errors.Add('Missing backup recovery runbook') }
if (-not (Test-Path -LiteralPath $designPath -PathType Leaf)) { [void]$errors.Add('Missing backup recovery design') }

if (Test-Path -LiteralPath $docPath) {
    $doc = Get-Content -LiteralPath $docPath -Raw -Encoding utf8
    $required = @(
        'FR-AUDIT-006',
        'NFR-BACKUP-001',
        'SUPABASE_ACCESS_TOKEN',
        'SUPABASE_DB_PASSWORD',
        'supabase db dump',
        'supabase db push',
        'psql',
        'Database > Backups',
        'Point-in-Time Recovery',
        'Storage',
        'Auth',
        'SHA-256',
        'RPO',
        'RTO'
    )
    foreach ($term in $required) {
        if ($doc -notlike "*$term*") { [void]$errors.Add("Runbook is missing required term: $term") }
    }
    if ($doc -match 'sb_(publishable|secret)_[A-Za-z0-9_-]{12,}') { [void]$errors.Add('Runbook appears to contain a real Supabase key') }
}

if (Test-Path -LiteralPath $designPath) {
    $design = Get-Content -LiteralPath $designPath -Raw -Encoding utf8
    foreach ($term in @('DES-BACKUP-RECOVERY-001', 'FR-AUDIT-006', 'NFR-BACKUP-001', 'RPO', 'RTO', 'Auth', 'Storage', 'SHA-256')) {
        if ($design -notlike "*$term*") { [void]$errors.Add("Design is missing required term: $term") }
    }
}

if ($errors.Count -gt 0) {
    Write-Host "Backup/recovery documentation check: FAILED ($($errors.Count) errors)" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host 'Backup/recovery documentation check: PASSED' -ForegroundColor Green
Write-Host 'Checked Spec IDs, secret boundaries, backup/restore commands, platform limits, verification, and rollback guidance.'
