# Frontend — NEXUS

SPA (Single Page Application) en Vanilla JS que consume la API de FastAPI en el mismo origen (`/api/...`).

## Estructura

```
frontend/
├── index.html              # Shell HTML con dos vistas SPA
└── assets/
    ├── css/style.css       # Sistema de diseño completo (variables CSS, componentes, animaciones)
    └── js/
        ├── main.js         # Orquestador: estado global (nexusState), pipeline, drag&drop, routing SPA
        ├── api.js          # Cliente HTTP (nexusAPI): encapsula todos los fetch calls
        ├── dashboard.js    # Lógica de UI: slider, cards, panel AI, exportar CSV
        ├── viz3d.js        # Scatter 3D con Plotly — clusters + diamantes de hoteles
        └── viz2d.js        # Diagrama de burbujas 2D con D3 — posicionamiento por centroid_3d real
```

## Vistas

### Vista 1 — Segmentación (`#view-segmentation`)
- **Sidebar izquierdo:** Slider de granularidad (min_cluster_size) + grid de hotel cards draggables (máx. 3 proyectados)
- **Canvas central:** Tabs 2D / 3D para visualizar clusters
- **Sidebar derecho:** Upload de CSV + panel estático de resumen del cluster seleccionado

### Vista 2 — Campañas (`#view-campaigns`)
- Grid de tarjetas expandibles, una por cluster
- Al expandir: llama a `/api/clusters/{id}/explain` → bullets de Gemini con recomendación de campaña
- Exportar CSV de GUEST_IDs por segmento

## Estado Global

```js
window.nexusState = {
  numClusters: 0,
  clusterCards: [],          // Perfiles con centroid_3d
  activeHotels: [],          // [{id, name, coords_3d}] — coords_3d guardadas tras proyección
  affineClusters: Set(),
  selectedCluster: null,
  explanationCache: {}       // Clave: "${clusterId}__${hotelIds|'none'}"
}
```

## Librerías externas (CDN)

| Librería | Versión | Uso |
|---|---|---|
| Plotly.js | 2.24.1 | Scatter 3D interactivo |
| D3.js | v7 | Diagrama de burbujas 2D |
| Google Fonts | — | Outfit (headings) + Inter (body) |
