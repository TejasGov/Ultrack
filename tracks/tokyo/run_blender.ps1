# usage: run_blender.ps1 <script.py> [-- args]   one Blender process, background, 6 threads, below-normal priority
param([Parameter(Mandatory=$true)][string]$Script,[string[]]$Rest=@(),[string]$Blend='',[string]$Log='')
if (Get-Process blender -ErrorAction SilentlyContinue) { Write-Error 'blender.exe already running'; exit 1 }
$a = @('-b','-t','6','--factory-startup')
if ($Blend) { $a += $Blend }
$a += @('-P',$Script)
if ($Rest.Count) { $a += '--'; $a += $Rest }
if (-not $Log) { $Log = [IO.Path]::ChangeExtension($Script,'.log') }
$p = Start-Process -FilePath 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -ArgumentList $a -PassThru -WindowStyle Hidden -RedirectStandardOutput $Log -RedirectStandardError ($Log+'.err')
$p.PriorityClass = 'BelowNormal'
$p.WaitForExit()
exit $p.ExitCode
