[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$catalogPath = Join-Path $root 'docs/demo/demo-data-catalog.json'
$runbookPath = Join-Path $root 'docs/demo/demo-runbook.md'
$environmentPath = Join-Path $root 'docs/demo/demo-environment.json'
$cleanupPath = Join-Path $root 'scripts/integration/demo-cleanup.sql'
$specPath = Join-Path $root 'specs/001-lims-core/spec.md'
$errors = [System.Collections.Generic.List[string]]::new()

foreach ($path in @($catalogPath, $runbookPath, $environmentPath, $cleanupPath, $specPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { [void]$errors.Add("Missing demo asset: $path") }
}

if ((Test-Path -LiteralPath $catalogPath) -and (Test-Path -LiteralPath $runbookPath) -and (Test-Path -LiteralPath $environmentPath) -and (Test-Path -LiteralPath $cleanupPath) -and (Test-Path -LiteralPath $specPath)) {
    $catalogText = Get-Content -LiteralPath $catalogPath -Raw -Encoding utf8
    $runbook = Get-Content -LiteralPath $runbookPath -Raw -Encoding utf8
    $environmentText = Get-Content -LiteralPath $environmentPath -Raw -Encoding utf8
    $cleanup = Get-Content -LiteralPath $cleanupPath -Raw -Encoding utf8
    $spec = Get-Content -LiteralPath $specPath -Raw -Encoding utf8
    try { $catalog = $catalogText | ConvertFrom-Json } catch { [void]$errors.Add('Demo catalog is not valid JSON'); $catalog = $null }
    try { $environment = $environmentText | ConvertFrom-Json } catch { [void]$errors.Add('Demo environment config is not valid JSON'); $environment = $null }

    if ($catalog) {
        if ($catalog.scenarioId -ne 'DEMO-LIMS-001') { [void]$errors.Add('Unexpected demo scenario ID') }
        if ($catalog.dataPolicy -ne 'synthetic-only') { [void]$errors.Add('Demo catalog must be synthetic-only') }
        if ($catalog.prefix -ne 'DEMO_') { [void]$errors.Add('Demo catalog must use the DEMO_ prefix') }
        if (@($catalog.roles).Count -lt 3) { [void]$errors.Add('Demo catalog must contain three role placeholders') }
        if (@($catalog.entities).Count -lt 8) { [void]$errors.Add('Demo catalog must contain core demo entities') }

        $p0Ids = [regex]::Matches($spec, '(?m)^\|\s*((?:FR)-[A-Z0-9-]+)\s*\|\s*P0\s*\|') |
            ForEach-Object { $_.Groups[1].Value } |
            Sort-Object -Unique
        $coverage = @($catalog.p0Coverage)
        foreach ($id in $p0Ids) {
            if ($coverage -notcontains $id) { [void]$errors.Add("P0 requirement missing from demo catalog: $id") }
            if ($runbook -notmatch [regex]::Escape($id)) { [void]$errors.Add("P0 requirement missing from demo runbook: $id") }
        }
        foreach ($id in $coverage) {
            if ($runbook -notmatch [regex]::Escape($id)) { [void]$errors.Add("Catalog coverage is not documented in runbook: $id") }
        }
    }

    if ($catalogText -match 'sb_(publishable|secret)_[A-Za-z0-9_-]{12,}' -or $runbook -match 'sb_(publishable|secret)_[A-Za-z0-9_-]{12,}') {
        [void]$errors.Add('Demo assets appear to contain a real Supabase key')
    }
    if ($environment) {
        if ($environment.scenarioId -ne 'DEMO-LIMS-001') { [void]$errors.Add('Demo environment has an unexpected scenario ID') }
        if ($environment.prefix -ne 'DEMO_') { [void]$errors.Add('Demo environment must use the DEMO_ prefix') }
        if (@($environment.accounts).Count -ne 3) { [void]$errors.Add('Demo environment must contain three account placeholders') }
        if ($environmentText -match 'sb_(publishable|secret)_[A-Za-z0-9_-]{12,}' -or $environmentText -match '(?i)"(password|token|service_role_key|secret)"\s*:') {
            [void]$errors.Add('Demo environment config must not contain credentials')
        }
        if ($environment.status -eq 'approved' -and $environment.isolated -ne $true) {
            [void]$errors.Add('Approved demo environment must be explicitly isolated')
        }
    }
    foreach ($requiredTerm in @('DEMO-LIMS-001', 'DEMO_P_001', 'DEMO_T_001', 'DEMO_S_001', 'Cleanup', 'Audit', 'permission')) {
        if ($runbook -notlike "*$requiredTerm*") { [void]$errors.Add("Demo runbook is missing required term: $requiredTerm") }
    }
    if ($cleanup -notmatch '(?i)\bbegin\s*;' -or $cleanup -notmatch '(?i)\bcommit\s*;') {
        [void]$errors.Add('Demo cleanup script must use an explicit transaction')
    }
    if ($cleanup -match '(?i)\b(drop\s+table|truncate\s+)' -or $cleanup -match '(?i)delete\s+from\s+auth\.users') {
        [void]$errors.Add('Demo cleanup script contains a forbidden broad or direct Auth deletion')
    }
    if ($cleanup -notmatch "(?i)auth\.users" -or $cleanup -notmatch '(?i)DEMO_') {
        [void]$errors.Add('Demo cleanup script must document Auth boundary and DEMO_ scope')
    }
}

if ($errors.Count -gt 0) {
    Write-Host "Demo asset check: FAILED ($($errors.Count) errors)" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host 'Demo asset check: PASSED' -ForegroundColor Green
Write-Host 'Checked synthetic data policy, role placeholders, P0 coverage, runbook references, and secret boundaries.'
