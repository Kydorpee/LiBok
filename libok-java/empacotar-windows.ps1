<#
  Gera o LiBok para Windows.

  Uso (PowerShell, na pasta libok-java):
    .\empacotar-windows.ps1              -> pasta dist\LiBok com LiBok.exe (não precisa instalar nada)
    .\empacotar-windows.ps1 -Instalador  -> também gera dist\LiBok-2.0.0.exe (instalador com atalhos)

  Requisitos na máquina que empacota: JDK 21 (com jpackage) e Maven.
  O instalador exige o WiX Toolset 3 (https://wixtoolset.org). O computador da biblioteca não precisa de nada.
#>
param([switch]$Instalador)

$ErrorActionPreference = 'Stop'
$versao = '2.0.0'
$modulos = 'java.base,java.compiler,java.desktop,java.instrument,java.logging,java.management,java.naming,' +
           'java.net.http,java.prefs,java.scripting,java.security.jgss,java.sql,java.xml,jdk.charsets,' +
           'jdk.crypto.ec,jdk.localedata,jdk.unsupported,jdk.zipfs'
$opcoesJlink = '--strip-debug --no-man-pages --no-header-files --include-locales=pt-BR,en'

Write-Host '1/3 Compilando e testando...' -ForegroundColor Green
mvn -B clean package
if ($LASTEXITCODE -ne 0) { throw 'Falha no build do Maven.' }

Remove-Item -Recurse -Force target\pacote, dist -ErrorAction SilentlyContinue
New-Item -ItemType Directory target\pacote | Out-Null
Copy-Item target\libok.jar target\pacote\

$comuns = @(
  '--name', 'LiBok', '--app-version', $versao, '--vendor', 'LiBok',
  '--description', 'Organização e empréstimos para pequenas bibliotecas',
  '--input', 'target\pacote', '--main-jar', 'libok.jar',
  '--icon', 'icon.ico', '--dest', 'dist',
  '--add-modules', $modulos, '--jlink-options', $opcoesJlink,
  '--java-options', '-Dfile.encoding=UTF-8', '--java-options', '-Xmx512m'
)

Write-Host '2/3 Gerando dist\LiBok\LiBok.exe...' -ForegroundColor Green
jpackage --type app-image @comuns
if ($LASTEXITCODE -ne 0) { throw 'Falha no jpackage.' }
Compress-Archive -Path dist\LiBok -DestinationPath "dist\LiBok-$versao-windows.zip" -Force

if ($Instalador) {
  Write-Host '3/3 Gerando instalador...' -ForegroundColor Green
  jpackage --type exe @comuns --win-menu --win-shortcut --win-dir-chooser --win-per-user-install `
    --win-menu-group 'LiBok' --win-upgrade-uuid '6f1d7f3e-5b1a-4c55-9d0b-2a8c1e0b7a11'
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Não foi possível gerar o instalador (o WiX Toolset 3 está instalado?). A versão portátil em dist\LiBok funciona normalmente.'
  }
} else {
  Write-Host '3/3 Instalador não solicitado (use -Instalador).' -ForegroundColor DarkGray
}

Write-Host "Pronto! Abra dist\LiBok\LiBok.exe ou distribua dist\LiBok-$versao-windows.zip." -ForegroundColor Green
