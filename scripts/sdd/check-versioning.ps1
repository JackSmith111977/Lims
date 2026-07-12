$ErrorActionPreference = "Stop"

$package = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
$lockHead = (Get-Content -LiteralPath "package-lock.json" -TotalCount 8) -join "`n"
$lockVersionMatch = [regex]::Match($lockHead, '"version"\s*:\s*"([^"]+)"')
$failures = @()

if ($package.version -notmatch '^\d+\.\d+\.\d+$') {
  $failures += "package.json version is not valid SemVer: $($package.version)"
}

if (-not $lockVersionMatch.Success -or $lockVersionMatch.Groups[1].Value -ne $package.version) {
  $failures += "package-lock.json root version does not match package.json"
}

if (-not (Test-Path -LiteralPath "CHANGELOG.md")) {
  $failures += "CHANGELOG.md is missing"
} elseif (-not (Select-String -LiteralPath "CHANGELOG.md" -Pattern '^## \[Unreleased\]' -Quiet)) {
  $failures += "CHANGELOG.md must contain an Unreleased section"
}

if (-not (Test-Path -LiteralPath "docs/sdd/versioning.md")) {
  $failures += "docs/sdd/versioning.md is missing"
}

if ($failures.Count -gt 0) {
  Write-Output "Versioning check: FAILED"
  $failures | ForEach-Object { Write-Output ("- " + $_) }
  exit 1
}

Write-Output "Versioning check: PASSED"
Write-Output ("Version: " + $package.version)
Write-Output "Checked package version, lockfile alignment, changelog, and versioning policy."
