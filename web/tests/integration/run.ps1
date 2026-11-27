<#
.SYNOPSIS
Pruebas HTTP de entrega del perfil y regresión de resúmenes, con base en memoria y buzón ficticio.
.EXAMPLE
$env:YUYAY_BACKEND_PATH = 'C:\ruta\dbp-yuyay'
npm run test:integration
.NOTES
Requiere PowerShell 7, JDK 26 y puertos 18068/18069 libres. No cambia ramas ni fuentes del backend.
El soporte Java se compila en una carpeta temporal y nunca forma parte de un despliegue.
#>
param(
  [string]$BackendPath = $env:YUYAY_BACKEND_PATH
)
$ErrorActionPreference = 'Stop'
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if ([string]::IsNullOrWhiteSpace($BackendPath)) { throw 'Indica -BackendPath o la variable YUYAY_BACKEND_PATH con la carpeta del backend local.' }
$backend = (Resolve-Path -LiteralPath $BackendPath).Path
if (!(Test-Path -LiteralPath (Join-Path $backend 'mvnw.cmd'))) { throw 'Falta el backend local con Maven Wrapper.' }
foreach ($port in @(18068, 18069)) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    throw "El puerto $port está ocupado. No se detendrá ningún proceso ajeno."
  }
}
$dir = Join-Path ([IO.Path]::GetTempPath()) ('yuyay-integration-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $dir | Out-Null
$classpathFile = Join-Path $dir 'classpath.txt'
$classes = Join-Path $dir 'classes'
New-Item -ItemType Directory -Path $classes | Out-Null
$qaBackendProcess = $null
$oldKey = $env:YUYAY_QA_CONTROL_KEY
$oldStorage = $env:YUYAY_QA_STORAGE_DIR
$oldUrl = $env:YUYAY_SUMMARY_TEST_URL
try {
  Push-Location $backend
  try {
    & .\mvnw.cmd -B test-compile dependency:build-classpath "-Dmdep.outputFile=$classpathFile" -DincludeScope=test *> (Join-Path $dir 'compile.log')
    if ($LASTEXITCODE -ne 0) { throw "Falló la compilación del backend. Consulta $dir\compile.log" }
  } finally { Pop-Location }
  $classPath = (Join-Path $backend 'target/test-classes') + ';' + (Join-Path $backend 'target/classes') + ';' + (Get-Content -LiteralPath $classpathFile -Raw).Trim()
  & javac -cp $classPath -d $classes (Join-Path $PSScriptRoot 'support/IntegrationBackend.java')
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el arranque de pruebas.' }
  $env:YUYAY_QA_CONTROL_KEY = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
  $env:YUYAY_QA_STORAGE_DIR = Join-Path $dir 'uploads'
  $env:YUYAY_SUMMARY_TEST_URL = 'http://127.0.0.1:18068'
  $fullClasspath = $classes + ';' + $classPath
  $jdkHome = (& javac -J-XshowSettings:properties -version 2>&1 | Select-String '^\s*java.home\s*=' | Select-Object -First 1).ToString().Split('=', 2)[1].Trim()
  $javaExecutable = Join-Path $jdkHome 'bin/java.exe'
  $qaBackendProcess = Start-Process -FilePath $javaExecutable -ArgumentList @('-cp', ('"' + $fullClasspath + '"'), 'qa.IntegrationBackend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $dir 'server.log') -RedirectStandardError (Join-Path $dir 'server-errors.log')
  $ready = $false
  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($qaBackendProcess.HasExited) { throw "El backend de pruebas terminó. Consulta $dir\server.log" }
    try {
      $status = Invoke-RestMethod -Uri 'http://127.0.0.1:18069/status' -Headers @{ 'X-QA-Control' = $env:YUYAY_QA_CONTROL_KEY } -TimeoutSec 2
      if ($status.ready) { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 250 }
  }
  if (!$ready) { throw "El backend aislado no inició. Consulta $dir\server.log" }
  Push-Location $webRoot
  try {
    foreach ($script in @('consultation-summary.ts', 'profile-claim.ts')) {
      & .\node_modules\.bin\tsx.cmd --tsconfig tsconfig.test.json --import ./tests/vite-env.mjs (Join-Path $PSScriptRoot $script)
      if ($LASTEXITCODE -ne 0) { throw "Falló la integración: $script" }
    }
  } finally { Pop-Location }
  Write-Output 'PASS integración de entrega del perfil y regresión del resumen existente.'
  Write-Output "Registros locales de pruebas: $dir"
} finally {
  if ($qaBackendProcess -and !$qaBackendProcess.HasExited) { Stop-Process -Id $qaBackendProcess.Id }
  $env:YUYAY_QA_CONTROL_KEY = $oldKey
  $env:YUYAY_QA_STORAGE_DIR = $oldStorage
  $env:YUYAY_SUMMARY_TEST_URL = $oldUrl
}
