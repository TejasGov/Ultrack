# Infinia's hill sign: nine white block letters on transparent, one row -> tex/bollywood.png (2304 x 320). Our own setting of a plain word,
# in the spirit of a big hillside sign; no logo.     powershell -STA -File make_bollywood.ps1
Add-Type -AssemblyName PresentationCore,WindowsBase
$root = 'D:/RaceUltimate/tracks/infinia'
$word = 'BOLLYWOOD'; $cw = 256; $ch = 320
$visual = New-Object System.Windows.Media.DrawingVisual; $dc = $visual.RenderOpen()
$bold = New-Object System.Windows.Media.Typeface (New-Object System.Windows.Media.FontFamily 'Arial Black'), ([System.Windows.FontStyles]::Normal), ([System.Windows.FontWeights]::Black), ([System.Windows.FontStretches]::Normal)
$en = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
$ink = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb(240, 238, 230))
for ($i = 0; $i -lt $word.Length; $i++) {
  $t = New-Object System.Windows.Media.FormattedText($word[$i].ToString(), $en, [System.Windows.FlowDirection]::LeftToRight, $bold, 300, $ink)
  $sx = [math]::Min(1.0, ($cw - 16) / $t.WidthIncludingTrailingWhitespace)
  $dc.PushTransform((New-Object System.Windows.Media.TranslateTransform(($i * $cw + ($cw - $t.WidthIncludingTrailingWhitespace * $sx) / 2), (-52))))
  $dc.PushTransform((New-Object System.Windows.Media.ScaleTransform($sx, 1.0)))
  $dc.DrawText($t, (New-Object System.Windows.Point(0, 0)))
  $dc.Pop(); $dc.Pop()
}
$dc.Close()
$bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(($cw * $word.Length), $ch, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32); $bmp.Render($visual)
$enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder; $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
$f = [System.IO.File]::Create("$root/tex/bollywood.png"); $enc.Save($f); $f.Dispose()
Write-Output "bollywood: $($word.Length) letters -> tex/bollywood.png"
