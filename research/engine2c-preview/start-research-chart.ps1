$ErrorActionPreference = "Stop"
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$site=Join-Path $root "build"
$private=Join-Path $root "pages"
if (!(Test-Path (Join-Path $site "engine2c-research\index.html"))) {throw "Missing research chart files"}
if (!(Test-Path (Join-Path $private "continuousRaw\continuousRaw-catalog.json"))) {throw "Missing historical data pages"}
$listener=[System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:8197/")
$listener.Start()
Write-Host "Local historical ES chart started. Close this window to stop."
Start-Process "http://127.0.0.1:8197/chart?symbol=ES&tf=10m&engine2cChart=research"
$views=@{"UNADJUSTED"="continuousRaw";"ADJUSTED_RESEARCH"="continuousAdjustedClose";"ACTUAL_CONTRACT"="actualESZ2026"}
$frames=@("5m","10m","1h","4h","1d","1w","1mo")
$catalogs=@{}
foreach($view in $views.Keys){
 $folder=$views[$view]
 $catalogs[$view]=Get-Content (Join-Path $private "$folder\$folder-catalog.json") -Raw | ConvertFrom-Json
}
function SendBytes($ctx,[int]$status,[byte[]]$data,[string]$mime){
 $ctx.Response.StatusCode=$status
 $ctx.Response.ContentType=$mime
 $ctx.Response.Headers.Add("Cache-Control","private, no-store")
 $ctx.Response.Headers.Add("X-Content-Type-Options","nosniff")
 $ctx.Response.ContentLength64=$data.Length
 $ctx.Response.OutputStream.Write($data,0,$data.Length)
 $ctx.Response.Close()
}
function Fail($ctx,[int]$status,[string]$message){
 $body=@{error=$message}|ConvertTo-Json -Compress
 SendBytes $ctx $status ([Text.Encoding]::UTF8.GetBytes($body)) "application/json"
}
try{
 while($listener.IsListening){
  $ctx=$listener.GetContext()
  try{
   if($ctx.Request.HttpMethod -ne "GET"){Fail $ctx 405 "METHOD_NOT_ALLOWED";continue}
   $uri=$ctx.Request.Url
   $pathname=[Uri]::UnescapeDataString($uri.AbsolutePath)
   if($pathname -eq "/engine2c-private-history/page"){
    $q=$ctx.Request.QueryString;$view=$q["view"];$frame=$q["frame"]
    if(!$views.ContainsKey([string]$view) -or $frames -notcontains $frame){Fail $ctx 400 "INVALID_SELECTION";continue}
    $cat=$catalogs[$view]
    if($q["datasetVersion"] -ne $cat.datasetVersion -or $q["priceBasisVersion"] -ne $cat.priceBasisVersion -or $q["limit"] -ne "1000" -or $q["direction"] -ne "DESC"){Fail $ctx 400 "INVALID_CONTEXT";continue}
    $cursor=$q["cursor"];$found=$null
    foreach($page in $cat.frames.$frame.pages){
     if(($null -eq $page.requestCursor -and $null -eq $cursor) -or ($null -ne $page.requestCursor -and $page.requestCursor -ceq $cursor)){$found=$page;break}
    }
    if($null -eq $found -or $found.name -notmatch '^[A-Za-z0-9_-]+\.json$'){Fail $ctx 404 "PAGE_NOT_FOUND";continue}
    $file=Join-Path (Join-Path $private $views[$view]) $found.name
    $bytes=[IO.File]::ReadAllBytes($file)
    if($bytes.Length -gt 2000000){Fail $ctx 503 "PAGE_TOO_LARGE";continue}
    $hasher=[Security.Cryptography.SHA256]::Create()
    try{$digest=([BitConverter]::ToString($hasher.ComputeHash($bytes))).Replace("-","").ToLowerInvariant()}finally{$hasher.Dispose()}
    if($digest -cne $found.sha256){Fail $ctx 503 "PAGE_CHECKSUM_INVALID";continue}
    SendBytes $ctx 200 $bytes "application/json; charset=utf-8";continue
   }
   if($pathname -eq "/"){$pathname="/index.html"}
   $rel=$pathname.TrimStart("/").Replace("/",[IO.Path]::DirectorySeparatorChar)
   $full=[IO.Path]::GetFullPath((Join-Path $site $rel))
   $prefix=[IO.Path]::GetFullPath($site).TrimEnd("\")+"\"
   if(!$full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){Fail $ctx 403 "FORBIDDEN";continue}
   if(!(Test-Path $full -PathType Leaf)){$full=Join-Path $site "index.html"}
   $ext=[IO.Path]::GetExtension($full).ToLowerInvariant()
   $mime=switch($ext){
    ".html"{"text/html; charset=utf-8"}
    ".js"{"application/javascript; charset=utf-8"}
    ".css"{"text/css; charset=utf-8"}
    ".json"{"application/json; charset=utf-8"}
    ".svg"{"image/svg+xml"}
    ".png"{"image/png"}
    ".ico"{"image/x-icon"}
    ".woff2"{"font/woff2"}
    default{"application/octet-stream"}
   }
   if($pathname -eq "/engine2c-research/index.html"){
    $html=[IO.File]::ReadAllText($full)
    $html=$html.Replace('<script src="./app.js"></script>','<script>window.__ENGINE2C_HISTORY_ENDPOINT__="/engine2c-private-history/page";</script><script src="./app.js"></script>')
    $bytes=[Text.Encoding]::UTF8.GetBytes($html)
   }else{$bytes=[IO.File]::ReadAllBytes($full)}
   SendBytes $ctx 200 $bytes $mime
  }catch{
   Write-Host "Request error: $($_.Exception.Message)"
   try{Fail $ctx 500 "LOCAL_SERVER_ERROR"}catch{}
  }
 }
}finally{$listener.Stop();$listener.Close()}
