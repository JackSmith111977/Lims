param(
  [Parameter(Mandatory = $true)]
  [string]$BranchName
)

$ErrorActionPreference = "Stop"

# 需求、验收、设计、任务和缺陷编号允许使用大写；可读 slug 使用小写。
$isValid = $false
$isValid = $isValid -or ($BranchName -match '^main$')
$isValid = $isValid -or ($BranchName -match '^(feature|fix)/((FR|NFR|AC|BR|DES|T|REV)-[A-Z0-9]+(?:-[A-Z0-9]+)*)-[a-z0-9]+(?:-[a-z0-9]+)*$')
$isValid = $isValid -or ($BranchName -match '^(refactor|docs|chore)/[a-z0-9]+(?:-[a-z0-9]+)*$')
$isValid = $isValid -or ($BranchName -match '^release/v\d+\.\d+\.\d+(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$')
$isValid = $isValid -or ($BranchName -match '^hotfix/v\d+\.\d+\.\d+-[a-z0-9]+(?:-[a-z0-9]+)*$')

if (-not $isValid) {
  Write-Output "Branch policy: FAILED"
  Write-Output ("Invalid branch name: " + $BranchName)
  Write-Output "Expected examples:"
  Write-Output "- feature/FR-SAMPLE-001-register-sample"
  Write-Output "- fix/BR-005-block-archived-task"
  Write-Output "- docs/sdd-versioning"
  Write-Output "- release/v0.2.0"
  exit 1
}

Write-Output ("Branch policy: PASSED (" + $BranchName + ")")
