# Infinia's green road signs, as Mumbai's: white on green with a white border, Marathi first, then Hindi, then English (research: NHAI circular 12.40/2025; state practice).
# Six direction panels for the overhead gantries and a welcome board. No real "Welcome to Mumbai" board was found to copy: its wording is ours.
#   powershell -STA -File make_road_signs.ps1   ->  tex/road_signs.png (2048 x 1536): rows 1-2 three panels of 682 x 384, row 3-4 the welcome board, 1024 x 768, at the left
Add-Type -AssemblyName PresentationCore,WindowsBase
$root = 'D:/RaceUltimate/tracks/infinia'
$en = [System.Globalization.CultureInfo]::GetCultureInfo('en-US'); $mr = [System.Globalization.CultureInfo]::GetCultureInfo('mr-IN')
function col($c) { [System.Windows.Media.Color]::FromRgb($c[0], $c[1], $c[2]) }
function brush($c) { New-Object System.Windows.Media.SolidColorBrush (col $c) }
function face($name, $weight) { New-Object System.Windows.Media.Typeface (New-Object System.Windows.Media.FontFamily $name), ([System.Windows.FontStyles]::Normal), $weight, ([System.Windows.FontStretches]::Normal) }
$deva = face 'Nirmala UI' ([System.Windows.FontWeights]::Bold); $latin = face 'Arial' ([System.Windows.FontWeights]::Bold)
$green = @(0, 104, 62); $white = @(250, 250, 245)
function line($dc, $s, $tf, $size, $maxW, $cx, $y, $cult) {
  $fs = $size; do { $t = New-Object System.Windows.Media.FormattedText($s, $cult, [System.Windows.FlowDirection]::LeftToRight, $tf, $fs, (brush $white)); $fs -= 2 } while ($t.Width -gt $maxW -and $fs -gt 10)
  $dc.DrawText($t, (New-Object System.Windows.Point(($cx - $t.Width / 2), $y)))
}
function board($dc, $x, $y, $w, $h) {
  $dc.DrawRectangle((brush $green), $null, (New-Object System.Windows.Rect($x, $y, $w, $h)))
  $dc.DrawRoundedRectangle($null, (New-Object System.Windows.Media.Pen((brush $white), 9)), (New-Object System.Windows.Rect(($x + 14), ($y + 14), ($w - 28), ($h - 28))), 14, 14)
}
function arrow($dc, $cx, $cy, $deg) {
  $dc.PushTransform((New-Object System.Windows.Media.RotateTransform($deg, $cx, $cy)))
  $g = [System.Windows.Media.Geometry]::Parse("M$cx,$($cy - 62) L$($cx + 48),$($cy - 8) L$($cx + 16),$($cy - 8) L$($cx + 16),$($cy + 62) L$($cx - 16),$($cy + 62) L$($cx - 16),$($cy - 8) L$($cx - 48),$($cy - 8) Z")
  $dc.DrawGeometry((brush $white), $null, $g); $dc.Pop()
}
$PANELS = @(
  @(([string]'वरळी सी लिंक'), ([string]'वर्ली सी लिंक'), 'WORLI SEA LINK', 0),
  @(([string]'वांद्रे'), ([string]'बांद्रा'), 'BANDRA', 40),
  @(([string]'मरीन ड्राइव्ह'), ([string]'मरीन ड्राइव'), 'MARINE DRIVE', -40),
  @(([string]'सागर बोगदा'), ([string]'सागर सुरंग'), 'SAGAR TUNNEL', 0),
  @(([string]'दादर'), ([string]'दादर'), 'DADAR', 40),
  @(([string]'कुलाबा'), ([string]'कोलाबा'), 'COLABA', -40)
)
$v = New-Object System.Windows.Media.DrawingVisual; $dc = $v.RenderOpen(); $cw = 2048 / 3; $ch = 384
for ($i = 0; $i -lt 6; $i++) {
  $x = ($i % 3) * $cw; $y = [math]::Floor($i / 3) * $ch; $p = $PANELS[$i]; board $dc $x $y $cw $ch
  arrow $dc ($x + 92) ($y + $ch / 2) $p[3]; $cx = $x + 92 + ($cw - 92) / 2 + 12; $mw = $cw - 200
  line $dc $p[0] $deva 88 $mw $cx ($y + 28) $mr; line $dc $p[1] $deva 62 $mw $cx ($y + 142) $mr; line $dc $p[2] $latin 62 $mw $cx ($y + 256) $en
}
$x = 0; $y = 2 * $ch; $w = 1024; $h = 768; board $dc $x $y $w $h
line $dc ([string]'मुंबईत आपले स्वागत आहे') $deva 104 ($w - 110) ($w / 2) ($y + 60) $mr
line $dc ([string]'मुंबई में आपका स्वागत है') $deva 84 ($w - 150) ($w / 2) ($y + 244) $mr
line $dc 'WELCOME TO MUMBAI' $latin 92 ($w - 130) ($w / 2) ($y + 400) $en
$dc.DrawRectangle((brush $white), $null, (New-Object System.Windows.Rect(120, ($y + 548), ($w - 240), 6)))
line $dc ([string]'सावकाश जा  ·  DRIVE SAFE') $deva 62 ($w - 220) ($w / 2) ($y + 584) $mr
$dc.Close()
$bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(2048, 1536, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32); $bmp.Render($v)
$enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder; $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
$f = [System.IO.File]::Create("$root/tex/road_signs.png"); $enc.Save($f); $f.Dispose()
Write-Output 'road signs -> tex/road_signs.png'
