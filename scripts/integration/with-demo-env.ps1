[CmdletBinding()]
param(
    [ValidateSet('preflight', 'start')]
    [string]$Action = 'preflight',
    [string]$EnvFile = '.env.demo.local',
    [int]$Port = 3100
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$resolvedEnvFile = if ([System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $root $EnvFile }
$allowedNames = @(
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEMO_PROJECT_REF'
)

if (-not (Test-Path -LiteralPath $resolvedEnvFile -PathType Leaf)) {
    throw "Missing isolated demo env file: $resolvedEnvFile (copy docs/demo/demo.env.local.example to .env.demo.local and fill it locally)"
}

$values = @{}
foreach ($line in (Get-Content -LiteralPath $resolvedEnvFile -Encoding utf8)) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) { continue }
    if ($trimmed -notmatch '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { throw 'Isolated demo env file contains an invalid line' }
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if ($allowedNames -notcontains $name) { throw "Isolated demo env file contains an unsupported variable: $name" }
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$name] = $value
}

foreach ($name in $allowedNames) {
    if (-not $values.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($values[$name])) {
        throw "Isolated demo env file is missing a value for: $name"
    }
    [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
}

Set-Location $root
if ($Action -eq 'preflight') {
    npm.cmd run demo:preflight
    exit $LASTEXITCODE
}

npm.cmd run start -- --port $Port
exit $LASTEXITCODE
