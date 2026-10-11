# Script de despliegue del Frontend en Vercel
# Ejecuta este script desde la raíz del proyecto

Write-Host "🚀 Desplegando CloudOps Frontend en Vercel..." -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en la raíz del proyecto
if (-not (Test-Path "frontend")) {
    Write-Host "❌ Error: Debes ejecutar este script desde la raíz del proyecto CloudOps" -ForegroundColor Red
    exit 1
}

# Cambiar al directorio del frontend
Set-Location frontend

Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host ""
Write-Host "🔨 Construyendo proyecto..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error en el build" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host ""
Write-Host "☁️  Desplegando a Vercel..." -ForegroundColor Yellow
Write-Host ""
Write-Host "INSTRUCCIONES:" -ForegroundColor Green
Write-Host "1. Si es tu primera vez, te pedirá que inicies sesión en Vercel" -ForegroundColor White
Write-Host "2. Selecciona tu cuenta cuando te lo pida" -ForegroundColor White
Write-Host "3. Cuando pregunte 'Set up and deploy?', presiona ENTER (Yes)" -ForegroundColor White
Write-Host "4. Cuando pregunte 'Which scope?', selecciona tu cuenta" -ForegroundColor White
Write-Host "5. Cuando pregunte 'Link to existing project?', presiona 'n' (No)" -ForegroundColor White
Write-Host "6. Cuando pregunte 'What's your project's name?', presiona ENTER o escribe 'cloudops'" -ForegroundColor White
Write-Host "7. Cuando pregunte 'In which directory is your code located?', escribe './' y presiona ENTER" -ForegroundColor White
Write-Host "8. Cuando pregunte 'Want to override settings?', presiona 'y' (Yes)" -ForegroundColor White
Write-Host "9. Cuando pregunte 'Build Command', presiona ENTER (usa el default)" -ForegroundColor White
Write-Host "10. Cuando pregunte 'Output Directory', presiona ENTER (usa 'dist')" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Después del despliegue, copia la URL de producción" -ForegroundColor Yellow
Write-Host ""

vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ ¡Frontend desplegado exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 PRÓXIMOS PASOS:" -ForegroundColor Cyan
    Write-Host "1. Copia la URL de producción que aparece arriba" -ForegroundColor White
    Write-Host "2. Guárdala, la necesitarás para configurar el backend" -ForegroundColor White
    Write-Host "3. Ejecuta el script 'deploy-backend.ps1' (si tienes backend)" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Error en el despliegue" -ForegroundColor Red
}

# Volver al directorio raíz
Set-Location ..
