[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$errors = [System.Collections.Generic.List[string]]::new()

function Add-Error([string]$Message) {
    [void]$errors.Add($Message)
}

function Require-File([string]$RelativePath) {
    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Error "缺少文件：$RelativePath"
    }
}

$requiredFiles = @(
    'AGENTS.md',
    'specs/README.md',
    'specs/constitution.md',
    'specs/product.md',
    'specs/001-lims-core/spec.md',
    'specs/001-lims-core/plan.md',
    'specs/001-lims-core/tasks.md',
    'specs/001-lims-core/traceability.md',
    'specs/001-lims-core/architecture.md',
    'specs/001-lims-core/data-model.md',
    'specs/001-lims-core/api-contract.md',
    'specs/001-lims-core/contracts/openapi.yaml',
    'docs/sdd/README.md',
    'docs/sdd/quality-gates.md',
    'docs/sdd/parallel-work.md',
    'docs/sdd/adversarial-review.md',
    'docs/sdd/versioning.md',
    'docs/sdd/consistency.md'
)

foreach ($file in $requiredFiles) {
    Require-File $file
}

$specPath = Join-Path $root 'specs/001-lims-core/spec.md'
$tracePath = Join-Path $root 'specs/001-lims-core/traceability.md'
$tasksPath = Join-Path $root 'specs/001-lims-core/tasks.md'
$openApiPath = Join-Path $root 'specs/001-lims-core/contracts/openapi.yaml'

if (Test-Path -LiteralPath $specPath) {
    $spec = Get-Content -LiteralPath $specPath -Raw -Encoding utf8
    $trace = if (Test-Path -LiteralPath $tracePath) { Get-Content -LiteralPath $tracePath -Raw -Encoding utf8 } else { '' }

    $specIds = [regex]::Matches($spec, '(?m)^\|\s*((?:FR|NFR|BR|AC)-[A-Z0-9-]+)\s*\|') |
        ForEach-Object { $_.Groups[1].Value } |
        Sort-Object -Unique

    foreach ($id in $specIds) {
        $family = ($id -replace '-\d+$', '-*')
        if (($trace -notmatch [regex]::Escape($id)) -and ($trace -notmatch [regex]::Escape($family))) {
            Add-Error "Requirement is missing from traceability matrix: $id"
        }
    }
}

$views = @()
foreach ($viewDir in @('docs/prd', 'docs/requirements')) {
    $path = Join-Path $root $viewDir
    if (Test-Path -LiteralPath $path) {
        $views += Get-ChildItem -LiteralPath $path -Filter '*.md' -File
    }
}

if ($views.Count -gt 0) {
    $viewMatches = Select-String -Path $views.FullName -Pattern '\b(?:FR|NFR|BR|AC)-[A-Z0-9-]+-\d+\b'
    if ($viewMatches) {
        Add-Error 'PRD/SRS views contain requirement IDs; keep requirement bodies in the canonical Spec.'
    }
}

if (Test-Path -LiteralPath $tasksPath) {
    $taskLines = Get-Content -LiteralPath $tasksPath -Encoding utf8
    foreach ($line in $taskLines) {
        if ($line -match '^\- \[[ x]\] T-\d+' -and $line -notmatch 'Spec|Plan') {
            Add-Error "Task is missing a Spec mapping: $line"
        }
    }
}

if (Test-Path -LiteralPath $openApiPath) {
    $openApi = Get-Content -LiteralPath $openApiPath -Raw -Encoding utf8
    if ($openApi -notmatch '(?m)^openapi:\s*3\.2\.0') {
        Add-Error 'OpenAPI contract does not declare version 3.2.0.'
    }
    if ($openApi -notmatch '(?m)^security:') {
        Add-Error 'OpenAPI contract is missing the global security declaration.'
    }
}

if ($errors.Count -gt 0) {
    Write-Host "SDD consistency check: FAILED ($($errors.Count) errors)" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}

Write-Host 'SDD consistency check: PASSED' -ForegroundColor Green
Write-Host "Checked required artifacts, requirement traceability, view isolation, task mappings, and OpenAPI metadata."
