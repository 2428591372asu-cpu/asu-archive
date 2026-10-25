# make-assets.ps1
# 从原始设定图集生成网站用图（统一命名 / 裁切 / 缩小 / 压缩）。
# 依赖：Windows 自带 System.Drawing，无需安装任何东西。
# 用法： powershell -ExecutionPolicy Bypass -File .\tools\make-assets.ps1
param(
  [string]$Src = 'D:\Asu\A_su的设定图集',
  [string]$Out = (Join-Path $PSScriptRoot '..\assets\img')
)

Add-Type -AssemblyName System.Drawing
$Out = [System.IO.Path]::GetFullPath($Out)
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# src   = 相对图集目录的路径
# out   = 站内文件名（.png 保留透明通道，.jpg 铺白底）
# max   = 长边像素上限
# q     = jpg 质量
# copy  = 原样复制
# crop  = 先裁切：@{x;y;w;h}（原图像素坐标）
$map = @(
  # ---- A_su：立绘 / 头像裁切 ----
  @{ src = '立绘透明底.png';        out = 'a-su-standing.png';    max = 1700 },
  @{ src = '立绘白底.png';          out = 'a-su-standing-w.jpg';  max = 1700; q = 86 },
  @{ src = '立绘透明底.png';        out = 'a-su-head.png';        crop = @{ x = 860; y = 300; w = 1280; h = 1260 }; max = 1000 },
  @{ src = '苦呀西表情透明底.png';  out = 'a-su-face-1.png';      max = 900 },
  @{ src = '苦呀西表情白底.png';    out = 'a-su-face-1-w.jpg';    max = 900; q = 86 },
  @{ src = '哈气表情透明底.png';    out = 'a-su-face-2.png';      max = 900 },
  @{ src = '哈气表情白底.png';      out = 'a-su-face-2-w.jpg';    max = 900; q = 86 },

  # ---- A_su：三视图 ----
  @{ src = '三视图排版1.png';       out = 'a-su-sheet-1.jpg';     max = 2600; q = 86 },
  @{ src = '三视图排版2.png';       out = 'a-su-sheet-2.jpg';     max = 2600; q = 86 },
  @{ src = '三视图无排版.png';      out = 'a-su-sheet-plain.jpg'; max = 2600; q = 86 },
  @{ src = 'A_su三视图.png';        out = 'a-su-turnaround.jpg';  max = 2600; q = 88 },

  # ---- A_su：头像 ----
  @{ src = '头像透明底.png';        out = 'a-su-avatar.png';      copy = $true },
  @{ src = '头像2透明底.png';       out = 'a-su-avatar2.png';     copy = $true },
  @{ src = '头像透明底带背景.png';  out = 'a-su-avatar-bg.jpg';   max = 900;  q = 88 },
  @{ src = '头像2透明底带背景.png'; out = 'a-su-avatar2-bg.jpg';  max = 900;  q = 88 },
  @{ src = '头像白底.jpg';          out = 'a-su-portrait.jpg';    max = 1200; q = 88 },
  @{ src = '头像白底2.jpg';         out = 'a-su-portrait2.jpg';   max = 1200; q = 88 },

  # ---- A_su：插画 / 其它 ----
  @{ src = '生贺.jpg';              out = 'a-su-birthday.jpg';    max = 2000; q = 86 },
  @{ src = '生贺差分.jpg';          out = 'a-su-birthday-alt.jpg'; max = 2000; q = 86 },
  @{ src = 'mc皮肤.png';            out = 'a-su-mcskin.png';      copy = $true },

  # ---- 双人 ----
  @{ src = '贴贴_无噪点.jpg';       out = 'together-clean.jpg';   max = 2200; q = 86 },
  @{ src = '贴贴原图.png';          out = 'together-original.jpg'; max = 2200; q = 82 },
  @{ src = '贴贴草稿.jpg';          out = 'together-draft.jpg';   max = 2000; q = 84 },
  @{ src = '蒲瓜相关\9CAF28CCE41731F49A9278343212605F.png'; out = 'together-picnic.jpg'; max = 2200; q = 86 },

  # ---- 蒲瓜：旧图 ----
  @{ src = '蒲瓜相关\9C9A46F97E524FCD5AF07F6973CB589D.png'; out = 'pugua-turnaround.jpg'; max = 2600; q = 88 },

  # ---- 蒲瓜图集：立绘 / 头像裁切（只有这几张真有透明通道，保留 PNG） ----
  @{ src = '蒲瓜图集\蒲瓜图集\立绘自拍杆透明底.PNG'; out = 'pugua-standing.png'; max = 1500 },
  @{ src = '蒲瓜图集\蒲瓜图集\立绘自拍杆透明底.PNG'; out = 'pugua-head.png';
     crop = @{ x = 380; y = 70; w = 4020; h = 4140 }; max = 1000 },
  @{ src = '蒲瓜图集\蒲瓜图集\1.8_59e38e55e0de84fd9e98d94db8ace587.PNG'; out = 'pugua-standing-2.png'; max = 1500 },
  @{ src = '蒲瓜图集\蒲瓜图集\E30F6A6793C6E0D5CDA67EB0ED713C5E.PNG'; out = 'pugua-standing-3.jpg'; max = 1500; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\IMG_0475.PNG'; out = 'pugua-face-4.png'; max = 900 },
  @{ src = '蒲瓜图集\蒲瓜图集\Q蒲瓜.PNG'; out = 'pugua-face-5.png'; max = 900 },

  # ---- 蒲瓜：像素（像素图用 PNG 更锐） ----
  @{ src = '蒲瓜图集\蒲瓜图集\像素蒲瓜.PNG'; out = 'pugua-pixel.png'; max = 1200 },
  @{ src = '蒲瓜图集\蒲瓜图集\3FD6835922D380FD5E6C1980162A6E38.PNG'; out = 'pugua-pixel-head.png'; copy = $true },
  @{ src = '蒲瓜图集\蒲瓜图集\IMG_0465.PNG'; out = 'pugua-pixel-ember.png'; copy = $true },

  # ---- 蒲瓜：头像 ----
  @{ src = '蒲瓜图集\蒲瓜图集\0bd5651d48ab7ec72a654ebb8927a840.JPG'; out = 'pugua-face-1.jpg'; max = 900; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\3EEFE4444833DA6FCD8F9FFC223E5A1D.PNG'; out = 'pugua-face-2.jpg'; max = 900; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\CEB340A809CCD954DBC078AFD6DA0588.PNG'; out = 'pugua-face-3.jpg'; max = 1000; q = 92 },

  # ---- 蒲瓜：三视图 / 设定 ----
  @{ src = '蒲瓜图集\蒲瓜图集\CAFB93E5B1652E9AA86872803DC683AB.JPG'; out = 'pugua-turnaround-2.jpg'; max = 2600; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\20C23D368DB57A41B5D6210F28A68F15.PNG'; out = 'pugua-lineart.jpg'; max = 2000; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\8101AF8AC89FFAE605764F4725D2719C.PNG'; out = 'pugua-sheet-1.jpg'; max = 1200; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\8D9040E55ACED71E93BAA81B20E3269D.PNG'; out = 'pugua-sheet-2.jpg'; max = 1200; q = 92 },

  # ---- 蒲瓜：插画 ----
  @{ src = '蒲瓜图集\蒲瓜图集\30A0EE7D924914384A388CB9EFFDD356.PNG'; out = 'pugua-selfie.jpg'; max = 1800; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\69A75FBBBA768940CE52AA9FE4D147CE.PNG'; out = 'pugua-halfbody.jpg'; max = 1600; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\86B0117C9DAAE1718B144EC39CFCD18A.PNG'; out = 'pugua-hat-green.jpg'; max = 1800; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\a80012eca79af7527d45c9ceb237ae3f.PNG'; out = 'pugua-pastel.jpg'; max = 1700; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\E8946668D26CB46A5948D208482D6B39.JPG'; out = 'pugua-portrait-1.jpg'; max = 1800; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\IMG_0470.JPG'; out = 'pugua-portrait-2.jpg'; max = 1200; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\IMG_0597.JPG'; out = 'pugua-fox.jpg'; max = 1600; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\watermark_temp_nG0zL1.PNG'; out = 'pugua-hat-1.jpg'; max = 1400; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\watermark_temp_pF6XD0.PNG'; out = 'pugua-hat-2.jpg'; max = 1400; q = 92 },

  # ---- 蒲瓜：细节 / 场景 ----
  @{ src = '蒲瓜图集\蒲瓜图集\IMG_0483.JPG'; out = 'pugua-eyes.jpg'; max = 1500; q = 92 },
  @{ src = '蒲瓜图集\蒲瓜图集\IMG_0495.PNG'; out = 'pugua-scene.jpg'; max = 1300; q = 92 }
)

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }

$manifest = @()
$rows = @()

foreach ($m in $map) {
  $srcPath = Join-Path $Src $m.src
  $outPath = Join-Path $Out $m.out
  if (-not (Test-Path -LiteralPath $srcPath)) {
    $rows += "MISSING  $($m.src)"
    continue
  }

  if ($m.copy) {
    Copy-Item -LiteralPath $srcPath -Destination $outPath -Force
    $img = [System.Drawing.Image]::FromFile($srcPath)
    $w = $img.Width; $h = $img.Height; $img.Dispose()
  }
  else {
    $img = [System.Drawing.Image]::FromFile($srcPath)
    $isPng = $outPath.ToLower().EndsWith('.png')

    # 裁切框（原图坐标）
    if ($m.crop) {
      $c = $m.crop
      $cx = [Math]::Max(0, [Math]::Min($c.x, $img.Width - 1))
      $cy = [Math]::Max(0, [Math]::Min($c.y, $img.Height - 1))
      $cw = [Math]::Min($c.w, $img.Width - $cx)
      $ch = [Math]::Min($c.h, $img.Height - $cy)
    } else {
      $cx = 0; $cy = 0; $cw = $img.Width; $ch = $img.Height
    }

    $maxd = [Math]::Max($cw, $ch)
    $scale = [Math]::Min(1.0, [double]$m.max / [double]$maxd)
    $w = [int][Math]::Round($cw * $scale); $h = [int][Math]::Round($ch * $scale)

    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    # PNG 保留透明通道；JPG 铺白底避免透明处变黑
    if ($isPng) { $g.Clear([System.Drawing.Color]::Transparent) }
    else { $g.Clear([System.Drawing.Color]::White) }
    $srcRect = New-Object System.Drawing.Rectangle($cx, $cy, $cw, $ch)
    $dstRect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()

    if ($isPng) {
      $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } else {
      $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, [long]$m.q)
      $bmp.Save($outPath, $jpegCodec, $ep)
      $ep.Dispose()
    }
    $bmp.Dispose(); $img.Dispose()
  }

  $bytes = (Get-Item -LiteralPath $outPath).Length
  $rows += ("{0,-24} {1,10} -> {2}x{3,-5} {4,7:N0} KB" -f $m.out, $m.src, $w, $h, ($bytes / 1kb))
  $manifest += [pscustomobject]@{ file = $m.out; w = $w; h = $h; bytes = $bytes }
}

$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $Out 'manifest.json') -Encoding utf8

$rows | ForEach-Object { Write-Output $_ }
Write-Output ("---- {0} files, total {1:N1} MB ----" -f $manifest.Count,
  ((($manifest | Measure-Object -Property bytes -Sum).Sum) / 1mb))
