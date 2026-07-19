[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$planPath = Join-Path $root 'docs/testing/system-test-plan.md'
$defectPath = Join-Path $root 'docs/testing/defect-log.md'
$specPath = Join-Path $root 'specs/001-lims-core/spec.md'
$errors = [System.Collections.Generic.List[string]]::new()

foreach ($path in @($planPath, $defectPath, $specPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { [void]$errors.Add("Missing system test artifact: $path") }
}

if ((Test-Path -LiteralPath $planPath) -and (Test-Path -LiteralPath $defectPath) -and (Test-Path -LiteralPath $specPath)) {
    $plan = Get-Content -LiteralPath $planPath -Raw -Encoding utf8
    $defects = Get-Content -LiteralPath $defectPath -Raw -Encoding utf8
    $spec = Get-Content -LiteralPath $specPath -Raw -Encoding utf8
    $acceptanceIds = [regex]::Matches($spec, '(?m)^\|\s*((?:AC)-[A-Z0-9-]+)\s*\|') |
        ForEach-Object { $_.Groups[1].Value } |
        Sort-Object -Unique
    foreach ($id in $acceptanceIds) {
        if ($plan -notmatch [regex]::Escape($id)) { [void]$errors.Add("Acceptance ID missing from test plan: $id") }
    }
    foreach ($term in @('T-503D', 'T-505C', 'P0', 'P1', 'cleanup', 'defect-log.md', 'ST-NEG-001')) {
        if ($plan -notlike "*$term*") { [void]$errors.Add("Test plan missing required term: $term") }
    }
    foreach ($term in @('ENV-503-001', 'ENV-505-001', 'Open', 'Mitigated')) {
        if ($defects -notlike "*$term*") { [void]$errors.Add("Defect log missing required term: $term") }
    }
    if ($plan -match 'sb_(publishable|secret)_[A-Za-z0-9_-]{12,}' -or $defects -match 'sb_(publishable|secret)_[A-Za-z0-9_-]{12,}') {
        [void]$errors.Add('System test artifacts appear to contain a real Supabase key')
    }
}

if ($errors.Count -gt 0) {
    Write-Host "System test plan check: FAILED ($($errors.Count) errors)" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host 'System test plan check: PASSED' -ForegroundColor Green
Write-Host 'Checked AC coverage, pending gates, negative scenarios, defect evidence, and secret boundaries.'
