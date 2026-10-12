# CloudOps

Repositorio separado en dos proyectos que se despliegan de manera independiente:

- `frontend/`: aplicación React + Vite. Funciona en modo demo sin configurar un backend.
- `backend/`: API Node.js sin dependencias externas, actualmente con respuestas simuladas.

La API no consulta ni modifica una cuenta de AWS todavía. Mantén credenciales y permisos AWS fuera del frontend.

## Ejecutar localmente

Requiere Node.js 18 o posterior. Desde la raíz del repositorio:

```bash
npm run install:frontend
npm run dev
```

En PowerShell de Windows, si la política de ejecución bloquea `npm.ps1`, usa `npm.cmd run install:frontend` y `npm.cmd run dev`. El comando `dev` inicia ambos servicios; el frontend funciona en `http://localhost:5173` y la API en `http://localhost:3001`. Para iniciarlos por separado usa `npm run dev:frontend` o `npm run dev:backend`.

Endpoints de demostración: `GET /health`, `/overview`, `/resources?region=us-east-1`, `/costs` y `/security/findings`. Todas las respuestas identifican los datos como simulados.

## Despliegue separado

### Frontend

En Vercel importa el repositorio y fija **Root Directory** en `frontend`; build `npm run build`, output `dist`. `frontend/vercel.json` configura el fallback SPA.

También puedes crear un Static Site en Render usando Root Directory `frontend`, build `npm install && npm run build` y publish directory `dist`.

Configura `VITE_CLOUD_API_URL` con la URL pública del backend, por ejemplo `https://cloudops-api.onrender.com`. Vite incorpora esta URL en el bundle público; solo debe contener una URL, nunca secretos.

### Backend

En Render crea un Web Service usando Root Directory `backend`. Build command `npm install && npm run build`, start command `npm start`. `backend/render.yaml` documenta este servicio. Configura `FRONTEND_ORIGINS` con el origen publicado del frontend, por ejemplo `https://mi-cloudops.vercel.app` (sin barra final).

El indicador del frontend comprueba `/health`. Las demás pantallas siguen usando sus datos de demostración/locales; la API todavía no está conectada a ellas.

## Próximo paso para AWS real

Implementar proveedores AWS en el backend con roles IAM de solo lectura y autenticación/autorización antes de conectar endpoints con pantallas. No uses access keys en variables `VITE_*`, commits, ni código del navegador. La API de ejemplo actual no tiene autenticación y no debe tratarse como un backend de producción con datos privados.
