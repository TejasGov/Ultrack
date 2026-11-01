# Infinia shop signs: invented shop names in Marathi / Hindi (Devanagari shaped by Windows text shaping, Nirmala UI, as
# tracks/india/create_sign_atlas.ps1) with an English line under, on painted boards. 4 x 8 signs of 512 x 128 -> tex/signs.png (2048 x 1024).
#   powershell -STA -File make_signs.ps1
Add-Type -AssemblyName PresentationCore,WindowsBase
$root = 'D:/RaceUltimate/tracks/infinia'
New-Item -ItemType Directory -Force "$root/tex" | Out-Null
$signs = @(
  @('श्री गणेश जनरल स्टोअर्स','SHREE GANESH GENERAL STORES'), @('साई मेडिकल','SAI MEDICAL & GENERAL'), @('जय भवानी वडा पाव','JAI BHAVANI VADA PAV'),
  @('सागर चहा केंद्र','SAGAR TEA CENTRE'), @('किराणा माल','KIRANA & PROVISIONS'), @('न्यू इंडिया सलून','NEW INDIA SALOON'),
  @('लक्ष्मी ज्वेलर्स','LAXMI JEWELLERS'), @('बॉम्बे टेलर्स','BOMBAY TAILORS'), @('कोळी मासळी बाजार','KOLI FISH MARKET'),
  @('पाटील फोटो स्टुडिओ','PATIL PHOTO STUDIO'), @('स्टेशनरी आणि झेरॉक्स','STATIONERY & XEROX'), @('हॉटेल सागर दर्शन','HOTEL SAGAR DARSHAN'),
  @('अन्नपूर्णा भोजनालय','ANNAPURNA BHOJANALAYA'), @('मोबाईल रिपेअर','MOBILE REPAIR'), @('शिवाजी सायकल मार्ट','SHIVAJI CYCLE MART'),
  @('गुरुकृपा हार्डवेअर','GURUKRUPA HARDWARE'), @('मराठा मिठाई','MARATHA SWEETS'), @('दत्त प्रिंटर्स','DATTA PRINTERS'),
  @('रॉयल ड्रायक्लीनर्स','ROYAL DRY CLEANERS'), @('विठ्ठल फुल भांडार','VITTHAL FLOWER STORE'), @('इराणी कॅफे','IRANI CAFE & BAKERY'),
  @('समुद्र रेस्टॉरंट','SAMUDRA RESTAURANT'), @('ओम साई ऑटो पार्ट्स','OM SAI AUTO PARTS'), @('गोल्डन फॅब्रिक्स','GOLDEN FABRICS'),
  @('चंद्रमा पान भांडार','CHANDRAMA PAN SHOP'), @('क्रांती बुक डेपो','KRANTI BOOK DEPOT'), @('अमृत डेअरी','AMRUT DAIRY'),
  @('नवरंग साडी सेंटर','NAVRANG SAREE CENTRE'), @('सिद्धिविनायक इलेक्ट्रिकल्स','SIDDHI ELECTRICALS'), @('मुंबई मसाला','MUMBAI MASALA'),
  @('बंदर चहा','BANDAR CHAI'), @('शांती लॉज','SHANTI LODGE')
)
# board colours (background, text, rule): painted shop boards
$pal = @(
  @(@(250,205,40),@(140,20,20),@(140,20,20)), @(@(170,25,30),@(255,240,210),@(255,200,60)), @(@(20,70,140),@(255,255,255),@(255,200,60)),
  @(@(250,250,245),@(20,90,40),@(200,40,30)), @(@(20,110,60),@(255,250,220),@(255,220,90)), @(@(245,130,30),@(30,20,10),@(30,20,10)),
  @(@(60,20,70),@(255,215,120),@(255,215,120)), @(@(240,235,220),@(20,40,110),@(20,40,110))
)
function brush($c) { New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromRgb($c[0],$c[1],$c[2])) }
$visual = New-Object System.Windows.Media.DrawingVisual
$dc = $visual.RenderOpen()
$deva = New-Object System.Windows.Media.Typeface (New-Object System.Windows.Media.FontFamily 'Nirmala UI'), ([System.Windows.FontStyles]::Normal), ([System.Windows.FontWeights]::Bold), ([System.Windows.FontStretches]::Normal)
$latin = New-Object System.Windows.Media.Typeface (New-Object System.Windows.Media.FontFamily 'Arial'), ([System.Windows.FontStyles]::Normal), ([System.Windows.FontWeights]::Bold), ([System.Windows.FontStretches]::Condensed)
$hi = [System.Globalization.CultureInfo]::GetCultureInfo('mr-IN'); $en = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
for ($i = 0; $i -lt $signs.Count; $i++) {
  $x = ($i % 4) * 512; $y = [math]::Floor($i / 4) * 128; $p = $pal[$i % $pal.Count]
  $dc.DrawRectangle((brush $p[0]), $null, (New-Object System.Windows.Rect($x, $y, 512, 128)))
  $dc.DrawRectangle((brush $p[2]), $null, (New-Object System.Windows.Rect(($x + 10), ($y + 8), 492, 4)))
  $dc.DrawRectangle((brush $p[2]), $null, (New-Object System.Windows.Rect(($x + 10), ($y + 116), 492, 4)))
  $fs = 54
  do { $t = New-Object System.Windows.Media.FormattedText($signs[$i][0], $hi, [System.Windows.FlowDirection]::LeftToRight, $deva, $fs, (brush $p[1])); $fs -= 1 } while ($t.Width -gt 470)
  $dc.DrawText($t, (New-Object System.Windows.Point(($x + (512 - $t.Width) / 2), ($y + 14 + (64 - $t.Height) / 2))))
  $fs = 26
  do { $e = New-Object System.Windows.Media.FormattedText($signs[$i][1], $en, [System.Windows.FlowDirection]::LeftToRight, $latin, $fs, (brush $p[1])); $fs -= 1 } while ($e.Width -gt 470)
  $dc.DrawText($e, (New-Object System.Windows.Point(($x + (512 - $e.Width) / 2), ($y + 82))))
}
$dc.Close()
$bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap(2048, 1024, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
$bmp.Render($visual)
$enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
$enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
$f = [System.IO.File]::Create("$root/tex/signs.png"); $enc.Save($f); $f.Dispose()
Write-Output "signs: $($signs.Count) boards -> tex/signs.png"
