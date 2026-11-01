# Infinia hoardings: invented brands (no real company, logo or slogan), English with a Marathi / Hindi line (Windows text shaping,
# Nirmala UI). 2 x 4 boards of 1024 x 384 -> tex/hoardings.png (2048 x 1536).    powershell -STA -File make_hoardings.ps1
Add-Type -AssemblyName PresentationCore,WindowsBase
$root = 'D:/RaceUltimate/tracks/infinia'
$ads = @(
  @('SAGAR TEA', 'चहा प्या, ताजे रहा', @(150,20,25), @(255,210,80), @(255,255,255)),
  @('MONSOON UMBRELLAS', 'पावसात बिनधास्त', @(20,60,140), @(255,255,255), @(120,200,255)),
  @('COASTAL CEMENT', 'मजबूत घर, मजबूत पाया', @(90,95,100), @(255,200,40), @(255,255,255)),
  @('VEGA MOBILE 5G', 'सगळ्यात वेगवान नेटवर्क', @(110,20,140), @(255,255,255), @(255,120,220)),
  @('STAR CINEMA', 'नवीन चित्रपट, या शुक्रवारी', @(15,15,20), @(255,190,40), @(255,255,255)),
  @('BOMBAY BISCUITS', 'प्रत्येक चहासोबत', @(240,170,30), @(120,30,10), @(120,30,10)),
  @('SEA LINK HOMES', 'समुद्राच्या दिशेने घर', @(10,110,120), @(255,255,255), @(200,255,240)),
  @('NAVRATRI UTSAV', 'नऊ रात्री, एक उत्सव', @(220,60,20), @(255,240,120), @(255,255,255))
)
function brush($c) { New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb($c[0],$c[1],$c[2])) }
$visual = New-Object System.Windows.Media.DrawingVisual; $dc = $visual.RenderOpen()
$bold = New-Object System.Windows.Media.Typeface (New-Object System.Windows.Media.FontFamily 'Arial Black'), ([System.Windows.FontStyles]::Normal), ([System.Windows.FontWeights]::Black), ([System.Windows.FontStretches]::Normal)
$deva = New-Object System.Windows.Media.Typeface (New-Object System.Windows.Media.FontFamily 'Nirmala UI'), ([System.Windows.FontStyles]::Normal), ([System.Windows.FontWeights]::Bold), ([System.Windows.FontStretches]::Normal)
$en = [System.Globalization.CultureInfo]::GetCultureInfo('en-US'); $mr = [System.Globalization.CultureInfo]::GetCultureInfo('mr-IN')
for ($i = 0; $i -lt $ads.Count; $i++) {
  $x = ($i % 2) * 1024; $y = [math]::Floor($i / 2) * 384; $a = $ads[$i]
  $dc.PushClip((New-Object System.Windows.Media.RectangleGeometry (New-Object System.Windows.Rect($x, $y, 1024, 384))))
  $dc.DrawRectangle((brush $a[2]), $null, (New-Object System.Windows.Rect($x, $y, 1024, 384)))
  $dc.DrawEllipse((brush $a[4]), $null, (New-Object System.Windows.Point(($x + 940), ($y + 192))), 170, 170)     # a bold shape at the right, our own
  $dc.DrawEllipse((brush $a[2]), $null, (New-Object System.Windows.Point(($x + 940), ($y + 192))), 110, 110)
  $fs = 120; do { $t = New-Object System.Windows.Media.FormattedText($a[0], $en, [System.Windows.FlowDirection]::LeftToRight, $bold, $fs, (brush $a[3])); $fs -= 2 } while ($t.Width -gt 700)
  $dc.DrawText($t, (New-Object System.Windows.Point(($x + 50), ($y + 60))))
  $fs = 64; do { $m = New-Object System.Windows.Media.FormattedText($a[1], $mr, [System.Windows.FlowDirection]::LeftToRight, $deva, $fs, (brush $a[4])); $fs -= 2 } while ($m.Width -gt 700)
  $dc.DrawText($m, (New-Object System.Windows.Point(($x + 54), ($y + 230))))
  $dc.DrawRectangle((brush @(240,240,235)), $null, (New-Object System.Windows.Rect($x, ($y + 370), 1024, 14)))
  $dc.Pop()
}
$dc.Close()
$bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(2048, 1536, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32); $bmp.Render($visual)
$enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder; $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
$f = [System.IO.File]::Create("$root/tex/hoardings.png"); $enc.Save($f); $f.Dispose()
Write-Output "hoardings: $($ads.Count) boards -> tex/hoardings.png"
