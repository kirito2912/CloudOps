# CloudOps Dashboard

Aplicación educativa en React para diseñar y explorar una arquitectura cloud basada en AWS. Los cambios se guardan en el navegador para conectar las pantallas y permitir que el cliente pruebe distintos escenarios.

## Tecnologías

- React 18 y TypeScript
- Vite
- Tailwind CSS 3 y CSS responsive
- React Router
- Lucide React

## Requisitos e instalación

Se requiere Node.js 18 o posterior y npm.

```bash
npm install
npm run dev
```

Vite imprime la dirección local en la terminal, normalmente `http://localhost:5173`.

```bash
npm run build
npm run preview
```

## Interacciones

- **Dashboard:** resumen de despliegues, postura de seguridad, gráfico que cambia entre seis y doce meses, y enlaces a cada módulo.
- **Planificación:** completa la propuesta, selecciona servicios y conserva el diseño en el navegador.
- **Costos:** modifica horas de operación y cantidad de recursos; el cálculo mensual y anual y el gráfico de distribución se actualizan al instante. Los parámetros quedan guardados.
- **Infraestructura global:** selecciona una región desde el mapa o la lista, filtra regiones con o sin despliegues, consulta latencia y recursos, y añade o retira servicios. El mapa enlaza las regiones activas y conserva los cambios.
- **Arquitectura de red:** selecciona componentes para leer su función; activa o desactiva CloudFront, NAT y una zona de disponibilidad, y anima o pausa el flujo de tráfico.
- **Seguridad e IAM:** expande las recomendaciones, marca controles como revisados o corregidos y activa o desactiva MFA en identidades de ejemplo.
- **Servicios AWS:** busca y filtra el catálogo, abre el detalle, incorpora servicios a la propuesta o simula su despliegue en distintas regiones.

Las pantallas comparten el estado del proyecto mediante `localStorage`. Puedes borrar la información desde la configuración de almacenamiento del navegador para recuperar el escenario inicial.

## Datos de ejemplo

Las regiones, latencias, controles, servicios y costos son datos simulados con fines educativos. La aplicación no consulta una cuenta ni despliega recursos reales en AWS; las ubicaciones del mapa son esquemáticas.

## Evidencias y demostración

Para capturar la entrega, inicia la aplicación y toma una captura de `/dashboard`, `/planning`, `/costs`, `/infrastructure`, `/security`, `/network` y `/services`, además de una vista en ancho móvil (por ejemplo, 390 px). Guarda las imágenes en `docs/evidencias/`.

En la demostración, crea una propuesta, cambia el despliegue entre regiones, modifica una capa del diagrama de red, marca una recomendación de seguridad y explica el modelo de responsabilidad compartida.

## Organización del código

```text
src/
├── components/CostChart.tsx
├── data/awsServices.ts
├── hooks/useLocalStorageState.ts
├── pages/
│   ├── InteractiveInfrastructure.tsx
│   ├── InteractiveNetwork.tsx
│   ├── InteractiveSecurity.tsx
│   └── InteractiveServices.tsx
├── types/cloud.ts
├── App.tsx
└── styles*.css
```
