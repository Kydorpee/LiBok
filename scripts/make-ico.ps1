# Monta os .ico multi-resolucao do LiBok a partir das fontes em docs/design/icon/.
#   src-tauri/icons/icon.ico  : 16/24/32/48 (simplificada) + 64/128/256 (completa)
#   src-tauri/icons/32x32.png : simplificada
#   public/favicon.ico        : 16/32/48 (simplificada)
# Uso (na raiz ou em qualquer pasta): powershell -File scripts/make-ico.ps1
# Rode DEPOIS de `npx tauri icon`, que sobrescreve icon.ico e 32x32.png.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root  = Split-Path -Parent $PSScriptRoot
$small = Join-Path $root 'docs/design/icon/app-icon-small-256.png'
$full  = Join-Path $root 'docs/design/icon/app-icon-1024.png'

function Resize-Png([string]$src, [int]$size) {
  $img = [System.Drawing.Image]::FromFile($src)
  try {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)), 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
    $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    return ,$ms.ToArray()
  } finally { $img.Dispose() }
}

# Grava um ICO com entradas PNG (suportado desde o Windows Vista).
function Write-Ico([string]$outIco, [int[]]$smallSizes, [int[]]$fullSizes) {
  $entries = @()
  foreach ($s in $smallSizes) { $entries += ,@($s, (Resize-Png $small $s)) }
  foreach ($s in $fullSizes)  { $entries += ,@($s, (Resize-Png $full $s)) }

  $fs = [System.IO.File]::Create($outIco)
  $bw = New-Object System.IO.BinaryWriter($fs)
  try {
    $bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$entries.Count)
    $offset = 6 + 16 * $entries.Count
    foreach ($e in $entries) {
      $sz = $e[0]; $data = $e[1]
      $dim = if ($sz -ge 256) { 0 } else { $sz }
      $bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
      $bw.Write([UInt16]1); $bw.Write([UInt16]32)
      $bw.Write([UInt32]$data.Length); $bw.Write([UInt32]$offset)
      $offset += $data.Length
    }
    foreach ($e in $entries) { $bw.Write([byte[]]$e[1]) }
  } finally { $bw.Close() }

  $b = [System.IO.File]::ReadAllBytes($outIco)
  $n = [BitConverter]::ToUInt16($b, 4)
  $list = for ($i = 0; $i -lt $n; $i++) { $w = $b[6 + 16 * $i]; if ($w -eq 0) { 256 } else { $w } }
  "$outIco -> $n entradas: $($list -join ', ')"
}

$publicDir = Join-Path $root 'public'
if (-not (Test-Path $publicDir)) { New-Item -ItemType Directory $publicDir | Out-Null }

Write-Ico (Join-Path $root 'src-tauri/icons/icon.ico') @(16, 24, 32, 48) @(64, 128, 256)
Write-Ico (Join-Path $publicDir 'favicon.ico') @(16, 32, 48) @()
$png32 = Join-Path $root 'src-tauri/icons/32x32.png'
[System.IO.File]::WriteAllBytes($png32, (Resize-Png $small 32))
"$png32 -> 32x32"
