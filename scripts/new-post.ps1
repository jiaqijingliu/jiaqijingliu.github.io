param(
  [string]$Title,
  [string]$FileName,
  [string]$Slug,
  [string]$Category,
  [string]$Tags,
  [string]$Summary
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$today = Get-Date -Format 'yyyy-MM-dd'

function Ask([string]$prompt, [string]$default) {
  if ($default) {
    $v = Read-Host "$prompt（回车 = $default）"
    if ([string]::IsNullOrWhiteSpace($v)) { return $default }
    return $v.Trim()
  }
  return (Read-Host $prompt).Trim()
}

# front-matter 里的字符串一律加双引号，避免标题里的冒号、# 之类把 YAML 拆坏
function Yaml([string]$s) {
  return '"' + $s.Replace('\', '\\').Replace('"', '\"') + '"'
}

# 文件名可以随便写（中文也行），这里只处理 Windows 不接受的字符：
#   \ / : * ? " < > | 换成短横线；结尾的点和空格去掉（Windows 不允许）；
#   开头的 _ 或 . 去掉 —— 构建会跳过这种文件，等于文章不存在。
function SafeFileName([string]$s) {
  $s = $s.Trim()
  $s = $s -replace '[\\/:*?"<>|]', '-'
  $s = $s -replace '-{2,}', '-'
  $s = $s -replace '\s{2,}', ' '
  $s = $s.Trim().TrimEnd('.', ' ')
  while ($s -match '^[_.]') { $s = $s.Substring(1) }
  if ($s.Length -gt 60) { $s = $s.Substring(0, 60).TrimEnd('.', ' ') }
  return $s
}

if (-not $PSBoundParameters.ContainsKey('Title')) { $Title = Ask '标题' '' }
if ([string]::IsNullOrWhiteSpace($Title)) {
  Write-Host '标题不能为空。' -ForegroundColor Red
  exit 1
}

# 默认文件名就是标题本身（中文没问题）。文件名只决定仓库里怎么找，
# 站内 URL 用的是下面自动生成的 ASCII slug。
$defaultName = SafeFileName $Title
if (-not $defaultName) { $defaultName = $today }

if (-not $PSBoundParameters.ContainsKey('FileName')) { $FileName = Ask '文件名' $defaultName }
if ([string]::IsNullOrWhiteSpace($FileName)) { $FileName = $defaultName }
$name = SafeFileName ($FileName.Trim() -replace '\.md$', '')
if (-not $name) { $name = $defaultName }

# 现有文章（跳过 _模板.md 和 . 开头的临时文件）
$mdFiles = Get-ChildItem -Path 'posts' -Recurse -Filter *.md -File |
  Where-Object { $_.Name -notlike '_*' -and $_.Name -notlike '.*' }

# 文件名重复时自动加 -2、-3，不覆盖已有文件
$knownNames = @{}
foreach ($f in $mdFiles) { $knownNames[$f.BaseName] = $true }
$baseName = $name
$i = 2
while ($knownNames.ContainsKey($name)) { $name = "$baseName-$i"; $i++ }

# slug 是全站唯一的，会出现在 blog/<slug>.html 和 #/post/<slug> 里。
# 手写 slug 的文章按手写的算，没写的按文件名算。
$knownSlugs = @{}
foreach ($f in $mdFiles) { $knownSlugs[$f.BaseName] = $true }
foreach ($f in $mdFiles) {
  $m = Select-String -Path $f.FullName -Pattern '^slug:\s*"?([A-Za-z0-9-]+)' -List
  if ($m) { $knownSlugs[$m.Matches[0].Groups[1].Value.ToLower()] = $true }
}

# slug 只能含 a-z / 0-9 / 短横线：站内路由的白名单就是这么定的。
# 默认从标题里的英文片段生成；全中文标题退回当天日期。
if (-not $PSBoundParameters.ContainsKey('Slug')) {
  $Slug = ($Title -replace '[^A-Za-z0-9]+', '-').Trim('-').ToLower()
  if (-not $Slug) { $Slug = $today }
}
$slug = ($Slug.Trim() -replace '\.md$', '').ToLower()
if ($slug -notmatch '^[a-z0-9-]+$') {
  Write-Host "slug 只能由 a-z、0-9、短横线组成（站内路由只认这个形状）：$slug" -ForegroundColor Red
  exit 1
}
if ($slug.Length -gt 60) { $slug = $slug.Substring(0, 60).Trim('-') }

# slug 撞车时同样自动加 -2、-3
$baseSlug = $slug
$i = 2
while ($knownSlugs.ContainsKey($slug)) { $slug = "$baseSlug-$i"; $i++ }

# 分类建议：从已有文章里现读，方便沿用同一个名字
$cats = @()
foreach ($f in $mdFiles) {
  $m = Select-String -Path $f.FullName -Pattern '^category:\s*(.+)$' -List
  if ($m) { $cats += $m.Matches[0].Groups[1].Value.Trim().Trim('"') }
}
$cats = $cats | Where-Object { $_ } | Sort-Object -Unique
$catHint = if ($cats) { "现有：$($cats -join ' / ')" } else { '回车 = 不分类' }

if (-not $PSBoundParameters.ContainsKey('Category')) { $Category = Ask "分类（$catHint）" '' }
if (-not $PSBoundParameters.ContainsKey('Tags')) { $Tags = (Read-Host '标签（逗号分隔，回车 = 不写）').Trim() }
if (-not $PSBoundParameters.ContainsKey('Summary')) { $Summary = (Read-Host '摘要（回车 = 自动截取正文第一段）').Trim() }

$tagList = @()
if ($Tags) {
  $tagList = $Tags -split '[,，]' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

# slug 一定要写进 front-matter：文件名是中文，默认 slug 会变成中文，
# 而站内路由只认 ASCII。
# slug 一定要加引号：没引号的 2026-10-28 会被 YAML 当成日期对象，
# 不是字符串。
$lines = @('---', "title: $(Yaml $Title)", "slug: $(Yaml $slug)", "date: $today")
if ($Category) { $lines += "category: $(Yaml $Category)" }
if ($tagList.Count) {
  $lines += 'tags: [' + (($tagList | ForEach-Object { Yaml $_ }) -join ', ') + ']'
}
if ($Summary) { $lines += "summary: $(Yaml $Summary)" }
$lines += '---', '', ''

$rel = Join-Path 'posts' "$name.md"
$full = Join-Path $repo $rel

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($full, ($lines -join "`n"), $utf8NoBom)

Write-Host ''
Write-Host "已创建：$rel" -ForegroundColor Green
Write-Host "站内地址：blog/$slug.html"
Write-Host '写完正文后，双击 posts\一键构建.cmd 重新生成页面。'
