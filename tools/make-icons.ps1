Add-Type -AssemblyName System.Drawing

function Get-StarPoints([int]$size, [double]$inset = 0.12) {
  # Matches the Beam mark path in index.html, scaled into a square canvas.
  $vb = 32.0
  $pad = $size * $inset
  $draw = $size - (2 * $pad)
  $scale = $draw / $vb
  $ox = $pad
  $oy = $pad
  $raw = @(
    @(16,2), @(18.4,11.1), @(28,16), @(18.4,20.9),
    @(16,30), @(13.6,20.9), @(4,16), @(13.6,11.1)
  )
  $pts = foreach ($p in $raw) {
    New-Object System.Drawing.PointF(($ox + $p[0] * $scale), ($oy + $p[1] * $scale))
  }
  return ,$pts
}

function Save-Icon([string]$path, [int]$size, [double]$inset, [bool]$rounded = $false) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 32, 32, 32))
  if ($rounded) {
    $radius = [Math]::Max(2, [int]($size * 0.2))
    $pathObj = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pathObj.AddArc(0, 0, $radius*2, $radius*2, 180, 90)
    $pathObj.AddArc($size-$radius*2, 0, $radius*2, $radius*2, 270, 90)
    $pathObj.AddArc($size-$radius*2, $size-$radius*2, $radius*2, $radius*2, 0, 90)
    $pathObj.AddArc(0, $size-$radius*2, $radius*2, $radius*2, 90, 90)
    $pathObj.CloseFigure()
    $bmp2 = New-Object System.Drawing.Bitmap $size, $size
    $g2 = [System.Drawing.Graphics]::FromImage($bmp2)
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g2.Clear([System.Drawing.Color]::Transparent)
    $g2.SetClip($pathObj)
    $g2.Clear([System.Drawing.Color]::FromArgb(255, 32, 32, 32))
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 163, 37))
    $g2.FillPolygon($brush, (Get-StarPoints $size $inset))
    $brush.Dispose(); $g2.Dispose()
    $bmp.Dispose(); $g.Dispose()
    $bmp2.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp2.Dispose()
    return
  }
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 163, 37))
  $g.FillPolygon($brush, (Get-StarPoints $size $inset))
  $brush.Dispose(); $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$root = "C:\Users\30013998\Projects\beam\icons"
# any-purpose icons (comfortable padding)
foreach ($s in 16,32,48,72,96,128,144,152,167,180,192,256,384,512) {
  Save-Icon (Join-Path $root "icon-$s.png") $s 0.14 $false
}
# maskable (more padding / safe zone)
foreach ($s in 192,512) {
  Save-Icon (Join-Path $root "icon-maskable-$s.png") $s 0.22 $false
}
# apple touch
Save-Icon (Join-Path $root "apple-touch-icon.png") 180 0.14 $false
# favicon pngs
Save-Icon (Join-Path $root "favicon-16x16.png") 16 0.12 $false
Save-Icon (Join-Path $root "favicon-32x32.png") 32 0.12 $false
Save-Icon (Join-Path $root "favicon-48x48.png") 48 0.12 $false

# Build multi-size favicon.ico from 16/32/48
$iconSizes = 16,32,48
$images = @()
foreach ($s in $iconSizes) {
  $images += [System.Drawing.Image]::FromFile((Join-Path $root "favicon-${s}x${s}.png"))
}
$icoPath = Join-Path $root "favicon.ico"
# Write ICO manually
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms
$bw.Write([UInt16]0)      # reserved
$bw.Write([UInt16]1)      # type icon
$bw.Write([UInt16]$images.Count)
$pngBlobs = @()
foreach ($img in $images) {
  $pms = New-Object System.IO.MemoryStream
  $img.Save($pms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBlobs += ,$pms.ToArray()
  $pms.Dispose()
}
$offset = 6 + (16 * $images.Count)
for ($i = 0; $i -lt $images.Count; $i++) {
  $w = $images[$i].Width; if ($w -ge 256) { $w = 0 }
  $h = $images[$i].Height; if ($h -ge 256) { $h = 0 }
  $bw.Write([Byte]$w)
  $bw.Write([Byte]$h)
  $bw.Write([Byte]0) # colors
  $bw.Write([Byte]0) # reserved
  $bw.Write([UInt16]1) # planes
  $bw.Write([UInt16]32) # bitcount
  $bw.Write([UInt32]$pngBlobs[$i].Length)
  $bw.Write([UInt32]$offset)
  $offset += $pngBlobs[$i].Length
}
foreach ($blob in $pngBlobs) { $bw.Write($blob) }
$bw.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$bw.Dispose(); $ms.Dispose()
foreach ($img in $images) { $img.Dispose() }

Get-ChildItem $root | Select-Object Name, Length | Format-Table -AutoSize
