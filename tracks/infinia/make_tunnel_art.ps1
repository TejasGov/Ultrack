# Infinia's tunnel art, drawn here: 12 film posters in the hand-painted Bollywood style (invented titles, no real film, actor, studio or
# artwork), truck-art wall bands and the tunnel's name board (Devanagari shaped by Windows, Nirmala UI, as the signs and hoardings are).
#   powershell -STA -File make_tunnel_art.ps1  ->  tex/tunnel_posters_painted.png (6 x 2, 2040 x 1024), tex/tunnel_band.png (2048 x 128), tex/tunnel_name.png (1024 x 128)
Add-Type -AssemblyName PresentationCore,WindowsBase
$root = 'D:/RaceUltimate/tracks/infinia'
$rng = New-Object System.Random 7
$en = [System.Globalization.CultureInfo]::GetCultureInfo('en-US'); $hi = [System.Globalization.CultureInfo]::GetCultureInfo('hi-IN')
function col($c, $a = 255) { [System.Windows.Media.Color]::FromArgb($a, $c[0], $c[1], $c[2]) }
function brush($c, $a = 255) { New-Object System.Windows.Media.SolidColorBrush (col $c $a) }
function pt($x, $y) { New-Object System.Windows.Point($x, $y) }
function face($name, $weight) { New-Object System.Windows.Media.Typeface (New-Object System.Windows.Media.FontFamily $name), ([System.Windows.FontStyles]::Normal), $weight, ([System.Windows.FontStretches]::Normal) }
$black = face 'Arial Black' ([System.Windows.FontWeights]::Black); $imp = face 'Impact' ([System.Windows.FontWeights]::Normal); $deva = face 'Nirmala UI' ([System.Windows.FontWeights]::Bold); $arial = face 'Arial' ([System.Windows.FontWeights]::Bold)
function text($dc, $s, $tf, $size, $maxW, $cx, $y, $fill, $outline, $thick, $cult) {
  # the type fitted to maxW, centred on cx, with a painted outline and a hard offset shadow
  $fs = $size; do { $t = New-Object System.Windows.Media.FormattedText($s, $cult, [System.Windows.FlowDirection]::LeftToRight, $tf, $fs, (brush $fill)); $fs -= 2 } while ($t.Width -gt $maxW -and $fs -gt 8)
  $x = $cx - $t.Width / 2; $g = $t.BuildGeometry((pt $x $y)); $sh = $t.BuildGeometry((pt ($x + $thick * 0.9) ($y + $thick * 0.9)))
  $dc.DrawGeometry((brush @(20,10,10)), $null, $sh)
  $pen = New-Object System.Windows.Media.Pen((brush $outline), $thick); $pen.LineJoin = [System.Windows.Media.PenLineJoin]::Round
  $dc.DrawGeometry((brush $fill), $pen, $g)
}
function shape($dc, $path, $x, $y, $s, $fill) {
  $g = [System.Windows.Media.Geometry]::Parse($path).Clone(); $tg = New-Object System.Windows.Media.TransformGroup
  $tg.Children.Add((New-Object System.Windows.Media.ScaleTransform($s, $s))); $tg.Children.Add((New-Object System.Windows.Media.TranslateTransform($x, $y))); $g.Transform = $tg
  $dc.DrawGeometry($fill, $null, $g)
}
# cut-paper figures in a 100 x 200 box: the poster's painted heroes, as silhouettes, faces never drawn
$HERO = 'M50,0 C62,0 68,12 66,24 C65,34 58,40 50,40 C42,40 35,34 34,24 C32,12 38,0 50,0 Z M30,44 L70,44 C80,46 86,56 88,74 L96,20 L106,22 L98,96 L84,100 L80,120 L84,200 L60,200 L52,130 L44,200 L20,200 L24,120 L14,84 C14,60 20,48 30,44 Z'
$HEROINE = 'M50,4 C60,4 66,14 64,24 C63,34 57,40 50,40 C43,40 37,34 36,24 C34,14 40,4 50,4 Z M36,44 L64,44 C74,48 78,60 76,76 L66,78 L66,96 C76,130 90,170 100,200 L0,200 C10,170 26,130 34,96 L32,78 L10,60 L16,50 L36,62 Z M66,48 L110,30 L114,38 L74,64 Z'
$DANCER = 'M60,0 C70,0 76,10 74,20 C73,30 66,36 58,36 C50,36 44,30 44,20 C44,10 50,0 60,0 Z M46,40 L70,40 L104,6 L112,14 L78,58 L74,92 C92,120 120,150 130,200 L104,200 C94,170 70,140 58,122 C46,144 32,172 26,200 L0,200 C6,160 24,120 40,92 L38,62 L6,40 L12,30 Z'
$CAR = 'M0,62 C2,48 12,44 30,40 L62,14 C70,8 80,6 96,6 L150,6 C166,6 176,10 186,20 L206,40 C226,42 240,48 244,62 L246,78 L216,78 C214,62 188,62 186,78 L62,78 C60,62 34,62 32,78 L0,78 Z'
$FILMS = @(
  @{ en='TOOFAN EXPRESS'; hi=([string]'तूफ़ान एक्सप्रेस'); a=@(200,30,20); b=@(250,170,30); ink=@(255,235,60); line=@(120,10,10); kind='car' },
  @{ en='DIL KA SIGNAL'; hi=([string]'दिल का सिग्नल'); a=@(190,20,110); b=@(250,140,160); ink=@(255,255,255); line=@(150,10,70); kind='couple' },
  @{ en='INSPECTOR BIJLI'; hi=([string]'इंस्पेक्टर बिजली'); a=@(15,25,70); b=@(40,130,190); ink=@(255,210,40); line=@(10,20,60); kind='hero' },
  @{ en='SAGAR KI RANI'; hi=([string]'सागर की रानी'); a=@(0,90,110); b=@(90,210,190); ink=@(255,240,190); line=@(0,60,80); kind='heroine' },
  @{ en='RAAT KA RAJA'; hi=([string]'रात का राजा'); a=@(20,10,40); b=@(120,40,130); ink=@(255,190,50); line=@(70,10,70); kind='hero' },
  @{ en='MOHALLA NO. 7'; hi=([string]'मोहल्ला नंबर ७'); a=@(170,70,10); b=@(245,190,70); ink=@(255,255,240); line=@(110,40,5); kind='crowd' },
  @{ en='CHAAR YAAR EK GAADI'; hi=([string]'चार यार एक गाड़ी'); a=@(20,110,60); b=@(230,210,60); ink=@(255,80,40); line=@(250,250,230); kind='car' },
  @{ en='PYAAR KA PANGA'; hi=([string]'प्यार का पंगा'); a=@(230,50,90); b=@(255,200,90); ink=@(255,255,120); line=@(150,10,60); kind='dance' },
  @{ en='KISMAT KI RACE'; hi=([string]'किस्मत की रेस'); a=@(120,10,10); b=@(255,110,20); ink=@(255,255,255); line=@(60,0,0); kind='car' },
  @{ en='AAKHRI LAP'; hi=([string]'आख़री लैप'); a=@(10,10,14); b=@(190,30,30); ink=@(255,215,0); line=@(90,0,0); kind='hero' },
  @{ en='DHAMAKA 1975'; hi=([string]'धमाका १९७५'); a=@(60,30,10); b=@(240,120,20); ink=@(255,240,80); line=@(120,20,0); kind='crowd' },
  @{ en='MAA KA VACHAN'; hi=([string]'माँ का वचन'); a=@(90,20,90); b=@(240,170,190); ink=@(255,250,210); line=@(70,10,70); kind='couple' }
)
$cw = 340; $ch = 512
$v = New-Object System.Windows.Media.DrawingVisual; $dc = $v.RenderOpen()
for ($i = 0; $i -lt 12; $i++) {
  $F = $FILMS[$i]; $x0 = ($i % 6) * $cw; $y0 = [math]::Floor($i / 6) * $ch; $cx = $x0 + $cw / 2
  $dc.PushClip((New-Object System.Windows.Media.RectangleGeometry (New-Object System.Windows.Rect($x0, $y0, $cw, $ch))))
  $grad = New-Object System.Windows.Media.RadialGradientBrush((col $F.b), (col $F.a)); $grad.GradientOrigin = pt 0.5 0.38; $grad.Center = pt 0.5 0.38; $grad.RadiusX = 0.85; $grad.RadiusY = 0.75
  $dc.DrawRectangle($grad, $null, (New-Object System.Windows.Rect($x0, $y0, $cw, $ch)))
  # sun rays behind the figures, a brushy streak or two: the painter's hand
  $sx = $cx; $sy = $y0 + 200
  for ($r = 0; $r -lt 18; $r++) {
    $a0 = $r * [math]::PI / 9 + 0.05; $a1 = $a0 + 0.11; $L = 620
    $g = [System.Windows.Media.Geometry]::Parse("M$sx,$sy L$($sx + $L * [math]::Cos($a0)),$($sy + $L * [math]::Sin($a0)) L$($sx + $L * [math]::Cos($a1)),$($sy + $L * [math]::Sin($a1)) Z")
    $dc.DrawGeometry((brush $F.b 46), $null, $g)
  }
  for ($r = 0; $r -lt 160; $r++) {
    $bx = $x0 + $rng.Next(0, $cw); $by = $y0 + $rng.Next(0, $ch); $bl = $rng.Next(10, 46); $tone = if ($rng.Next(2)) { @(255,255,255) } else { @(0,0,0) }
    $dc.DrawLine((New-Object System.Windows.Media.Pen((brush $tone $rng.Next(8, 26)), $rng.Next(2, 6))), (pt $bx $by), (pt ($bx + $bl) ($by + $rng.Next(-6, 6))))
  }
  $ink = brush @(16,8,14)
  $halo = brush $F.b 120
  switch ($F.kind) {
    'hero' { $dc.DrawEllipse($halo, $null, (pt $cx ($y0 + 160)), 118, 118); shape $dc $HERO ($cx - 62) ($y0 + 70) 1.25 $ink }
    'heroine' { $dc.DrawEllipse($halo, $null, (pt $cx ($y0 + 165)), 118, 118); shape $dc $HEROINE ($cx - 62) ($y0 + 74) 1.22 $ink }
    'couple' { $dc.DrawEllipse($halo, $null, (pt $cx ($y0 + 165)), 132, 132); shape $dc $HERO ($cx - 102) ($y0 + 70) 1.22 $ink; shape $dc $HEROINE ($cx - 8) ($y0 + 88) 1.1 $ink }
    'dance' { $dc.DrawEllipse($halo, $null, (pt $cx ($y0 + 165)), 132, 132); shape $dc $DANCER ($cx - 138) ($y0 + 100) 1.05 $ink; shape $dc $DANCER ($cx + 4) ($y0 + 100) 1.05 $ink }
    'crowd' { foreach ($k in 0..4) { shape $dc $HERO ($x0 + 2 + $k * 66) ($y0 + 124 + (($k % 2) * 24)) (0.86 + ($k % 2) * 0.06) $ink } }
    'car' { $dc.DrawEllipse($halo, $null, (pt $cx ($y0 + 170)), 128, 128); shape $dc $HERO ($cx - 42) ($y0 + 50) 0.82 $ink; shape $dc $CAR ($x0 + 22) ($y0 + 218) 1.2 $ink }
  }
  # the words: Hindi big, the romanised title, the old release line
  $dc.DrawRectangle((brush $F.a 205), $null, (New-Object System.Windows.Rect($x0, ($y0 + 318), $cw, 194)))
  text $dc $F.hi $deva 78 ($cw - 24) $cx ($y0 + 318) $F.ink $F.line 3 $hi
  text $dc $F.en $imp 52 ($cw - 28) $cx ($y0 + 416) @(255,255,255) $F.line 2 $en
  text $dc 'NOW SHOWING  ·  ALL CINEMAS' $arial 15 ($cw - 40) $cx ($y0 + 482) $F.ink $F.line 0.5 $en
  $dc.DrawRectangle($null, (New-Object System.Windows.Media.Pen((brush @(245,238,215)), 7)), (New-Object System.Windows.Rect(($x0 + 3.5), ($y0 + 3.5), ($cw - 7), ($ch - 7))))
  $dc.Pop()
}
$dc.Close()
function save($vis, $w, $h, $file) { $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap($w, $h, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32); $bmp.Render($vis); $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder; $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp)); $f = [System.IO.File]::Create("$root/tex/$file"); $enc.Save($f); $f.Dispose() }
save $v (6 * $cw) (2 * $ch) 'tunnel_posters_painted.png'      # only the fallback now: make_poster_atlas.mjs lays out the real posters

# the truck-art band, repeating: stripes, lotuses, diamonds and the slogans every Indian highway knows (public sayings, no marks)
$v = New-Object System.Windows.Media.DrawingVisual; $dc = $v.RenderOpen()
$bandW = 2048; $bandH = 128; $dc.DrawRectangle((brush @(14,70,80)), $null, (New-Object System.Windows.Rect(0, 0, $bandW, $bandH)))
foreach ($st in @(@(0,12,@(240,180,20)), @(12,6,@(200,30,40)), @(($bandH - 18),6,@(200,30,40)), @(($bandH - 12),12,@(240,180,20)))) { $dc.DrawRectangle((brush $st[2]), $null, (New-Object System.Windows.Rect(0, $st[0], $bandW, $st[1]))) }
for ($x = 0; $x -lt $bandW; $x += 32) { $dc.DrawGeometry((brush @(250,240,210)), $null, [System.Windows.Media.Geometry]::Parse("M$x,18 L$($x + 16),30 L$($x + 32),18 Z")); $dc.DrawGeometry((brush @(250,240,210)), $null, [System.Windows.Media.Geometry]::Parse("M$x,$($bandH - 18) L$($x + 16),$($bandH - 30) L$($x + 32),$($bandH - 18) Z")) }
function lotus($dc, $cx, $cy, $r, $c1, $c2) {
  for ($k = 0; $k -lt 8; $k++) { $a = $k * [math]::PI / 4; $tx = $cx + $r * [math]::Cos($a); $ty = $cy + $r * [math]::Sin($a); $lx = $cx + 0.42 * $r * [math]::Cos($a + 0.7); $ly = $cy + 0.42 * $r * [math]::Sin($a + 0.7); $mx = $cx + 0.42 * $r * [math]::Cos($a - 0.7); $my = $cy + 0.42 * $r * [math]::Sin($a - 0.7)
    $dc.DrawGeometry((brush $c1), (New-Object System.Windows.Media.Pen((brush @(250,240,210)), 1.5)), [System.Windows.Media.Geometry]::Parse("M$cx,$cy L$lx,$ly L$tx,$ty L$mx,$my Z")) }
  $dc.DrawEllipse((brush $c2), $null, (pt $cx $cy), ($r * 0.28), ($r * 0.28))
}
$mid = $bandH / 2
foreach ($m in @(@(100,@(230,50,90),@(250,210,40)), @(620,@(250,150,20),@(200,30,40)), @(1140,@(240,240,230),@(230,50,90)), @(1660,@(250,210,40),@(20,120,90)))) { lotus $dc $m[0] $mid 30 $m[1] $m[2] }
$sayings = @(@(360,'HORN OK PLEASE',$imp,$en,@(255,225,60)), @(880,([string]'बुरी नज़र वाले तेरा मुँह काला'),$deva,$hi,@(255,255,255)), @(1400,([string]'हॉर्न ओके प्लीज़'),$deva,$hi,@(255,225,60)), @(1860,'USE DIPPER AT NIGHT',$imp,$en,@(255,255,255)))
foreach ($s in $sayings) { text $dc $s[1] $s[2] 46 330 $s[0] 32 $s[4] @(150,20,30) 1.5 $s[3] }
$dc.Close(); save $v $bandW $bandH 'tunnel_band.png'

# the name over the tunnel's mouths
$v = New-Object System.Windows.Media.DrawingVisual; $dc = $v.RenderOpen()
$dc.DrawRectangle((brush @(14,70,80)), (New-Object System.Windows.Media.Pen((brush @(240,180,20)), 8)), (New-Object System.Windows.Rect(4, 4, 1016, 120)))
lotus $dc 70 64 40 @(250,150,20) @(200,30,40); lotus $dc 954 64 40 @(250,150,20) @(200,30,40)
text $dc ([string]'सागर बोगदा') $deva 74 340 300 8 @(255,240,190) @(120,20,30) 2 $hi
text $dc 'SAGAR TUNNEL' $imp 70 340 720 18 @(255,255,255) @(120,20,30) 2 $en
$dc.Close(); save $v 1024 128 'tunnel_name.png'
Write-Output 'tunnel art -> tex/tunnel_posters_painted.png, tunnel_band.png, tunnel_name.png'
