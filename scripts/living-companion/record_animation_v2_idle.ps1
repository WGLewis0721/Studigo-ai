param(
    [Parameter(Mandatory)]
    [string] $OutputDirectory,
    [ValidateRange(1, 120)]
    [int] $Seconds = 60,
    [ValidateRange(150, 800)]
    [int] $Size = 360
)

$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot '../../design/living-companion/rive/studigo'
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('studigo-idle-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratch | Out-Null
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path
$fps = 24
$total = $fps * $Seconds
$previousTick = 0

# Sample one continuously advanced Rive instance. At 24 fps the nearest
# 60 Hz tick alternates between two and three ticks per capture.
$commands = for ($frame = 0; $frame -le $total; $frame++) {
    $tick = [int][Math]::Round($frame * 60 / $fps)
    $step = $tick - $previousTick
    if ($step -gt 0) { "advance $step" }
    $previousTick = $tick
    'screenshot ' + (Join-Path $scratch ('frame-{0:D4}.png' -f $frame))
}

$results = $commands | rive $project --commands "--viewport=${Size}x${Size}" --fit=contain 2>&1
$riveExit = $LASTEXITCODE
$failures = @($results | Where-Object { "$_" -match '^(err |.*\berror\s+)' })
$captures = @($results | Where-Object { "$_" -like 'ok screenshot:*' })
if ($riveExit -ne 0 -or $failures.Count -gt 0 -or $captures.Count -ne $total + 1) {
    $results | Select-Object -Last 24
    throw "Rive capture failed. Expected $($total + 1) frames, got $($captures.Count). Scratch: $scratch"
}

$movie = Join-Path $output "idle-${Seconds}s.mp4"
ffmpeg -v error -n -framerate $fps -i (Join-Path $scratch 'frame-%04d.png') `
    -frames:v $total -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart $movie
if ($LASTEXITCODE -ne 0) { throw "FFmpeg encoding failed. Scratch: $scratch" }

Write-Output "Captured $($captures.Count) renders in one Rive session. Video: $movie"
Write-Output "Lossless frames: $scratch"
