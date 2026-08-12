param(
  [switch]$NoBrowser,
  [int]$PreferredPort = 8783
)

$ErrorActionPreference = 'Stop'
$gameRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $gameRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$listener = $null
$port = 0

for ($candidate = $PreferredPort; $candidate -le ($PreferredPort + 20); $candidate++) {
  try {
    $candidateListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
    $candidateListener.Start()
    $listener = $candidateListener
    $port = $candidate
    break
  } catch {
    if ($candidateListener) {
      try { $candidateListener.Stop() } catch {}
    }
  }
}

if (-not $listener) {
  throw "No free local port was found for the game launcher."
}

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif' = 'image/gif'
  '.webp' = 'image/webp'
  '.ico' = 'image/x-icon'
  '.wav' = 'audio/wav'
  '.mp3' = 'audio/mpeg'
  '.ogg' = 'audio/ogg'
  '.woff' = 'font/woff'
  '.woff2' = 'font/woff2'
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body,
    [bool]$HeadOnly = $false
  )

  $headerText = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if (-not $HeadOnly -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
  $Stream.Flush()
}

$url = "http://127.0.0.1:$port/?offline=1"
Write-Host ''
Write-Host 'TERMINAL CASINO - OFFLINE LAUNCHER' -ForegroundColor Cyan
Write-Host "Opening the game at $url"
Write-Host 'This window only serves local game files. It does not run or require the game server.'
Write-Host 'Keep this window open while playing. Press Ctrl+C or close it to stop.'
Write-Host ''

if (-not $NoBrowser) {
  Start-Process $url
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $null
    $reader = $null
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }

      while ($true) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) { break }
      }

      $parts = $requestLine.Split(' ')
      $method = if ($parts.Length -gt 0) { $parts[0].ToUpperInvariant() } else { '' }
      $rawTarget = if ($parts.Length -gt 1) { $parts[1] } else { '/' }
      if ($method -ne 'GET' -and $method -ne 'HEAD') {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Method not allowed')
        Send-Response $stream 405 'Method Not Allowed' 'text/plain; charset=utf-8' $body ($method -eq 'HEAD')
        continue
      }

      $pathOnly = $rawTarget.Split('?')[0]
      $decodedPath = [System.Uri]::UnescapeDataString($pathOnly).Replace('/', [System.IO.Path]::DirectorySeparatorChar).TrimStart([System.IO.Path]::DirectorySeparatorChar)
      if ([string]::IsNullOrWhiteSpace($decodedPath)) { $decodedPath = 'index.html' }
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $gameRoot $decodedPath))

      if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.File]::Exists($filePath)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $body ($method -eq 'HEAD')
        continue
      }

      $body = [System.IO.File]::ReadAllBytes($filePath)
      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
      Send-Response $stream 200 'OK' $contentType $body ($method -eq 'HEAD')
    } catch {
      Write-Warning $_.Exception.Message
    } finally {
      if ($reader) { $reader.Dispose() }
      if ($stream) { $stream.Dispose() }
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
