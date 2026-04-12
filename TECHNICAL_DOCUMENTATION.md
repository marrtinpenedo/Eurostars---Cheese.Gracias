# 📘 NEXUS — Documentación Técnica

**NEXUS** es la plataforma analítica de segmentación de clientes de Eurostars Hotel Company. Combina Topología de Datos (UMAP + HDBSCAN), proyecciones vectoriales inversas y modelos fundacionales (Vertex AI / Gemini) para transformar datos de comportamiento histórico en insights accionables de marketing.

---

## 🏗️ 1. Arquitectura del Sistema

El proyecto sigue una arquitectura **monolítica ligera** donde un único proceso sirve tanto el backend analítico como la interfaz web del cliente.

| Capa | Tecnología | Justificación |
|---|---|---|
| **Servidor API** | FastAPI (Python 3.12) | Tipado estático, soporte asíncrono, `StaticFiles` elimina la necesidad de un servidor web independiente |
| **Frontend** | Vanilla JS + HTML5 + CSS3 | Zero-build deployment; ES modules nativos; sin dependencias de compilación |
| **Visualización 3D** | Plotly.js 2.24 (CDN) | WebGL nativo, scatter3d interactivo con zoom/orbit sin bloquear el hilo principal |
| **Visualización 2D** | D3.js v7 (CDN) | Diagrama de burbujas con posicionamiento basado en centroides UMAP reales |
| **IA Generativa** | Google Vertex AI SDK (`google-genai`) | Gemini 2.5 Flash: balance óptimo velocidad/calidad para respuestas en tiempo real |

### Estado de la aplicación

El estado global del frontend vive en `window.nexusState`:

```js
{
  numClusters: 0,
  clusterCards: [],          // Perfiles de clusters (con centroid_3d)
  activeHotels: [],          // [{id, name, coords_3d}]
  affineClusters: Set(),
  selectedCluster: null,
  explanationCache: {}       // claves: "${cid}__${hotelIds}"
}
```

El backend mantiene su propio estado en `app.state`:
- `customers_clean`, `hotels_clean` — DataFrames limpios
- `stayprint_vector` — Matriz de features final (nombre heredado del atributo `app.state`)
- `embeddings_15d`, `embeddings_3d` — Proyecciones UMAP
- `cluster_cards` — Perfiles del profiler
- `explanations_cache` — `dict[(cluster_id, hotel_name) -> bullets]`

---

## 🧬 2. Pipeline Analítico — Paso a Paso

### Fase 1 — Carga (`POST /api/pipeline/execute`)

1. **DataLoader** (`src/data/loader.py`): Lee los CSV con `sep=";"`, fuerza `GUEST_ID` y `HOTEL_ID` a `str` con `zfill(3)` para garantizar joins consistentes.
2. **DataPreprocessor** (`src/data/preprocessor.py`): Mapea `AGE_RANGE` a ordinal numérico (`AGE_NUM`), extrae `CHECKIN_MONTH` del datetime, limpia nulos.

### Fase 2 — Feature Engineering

3. **FeatureBuilder** (`src/data/feature_builder.py`): `LEFT JOIN` clientes↔hoteles por `HOTEL_ID`, agrega por `GUEST_ID` (mean/max/first), calcula `FAV_CLIMATE` y `PEAK_MONTH` por moda, aplica **One-Hot Encoding** a variables categóricas (`COUNTRY_GUEST`, `GENDER_ID`, `FAV_CLIMATE`). Resultado: ~100 features numéricas por cliente.
4. **FeatureEmbedder** (`src/embeddings/embedder.py`): `StandardScaler.fit_transform()`. Persiste el scaler en `models/scaler.pkl`.

### Fase 3 — Reducción Dimensional

5. **DimensionalityReducer** (`src/embeddings/reducer.py`): Entrena **dos** modelos UMAP independientes sobre los mismos datos escalados:
   - `umap_model_15d.pkl` — 15 dimensiones, `n_neighbors=15`, `min_dist=0.0` → input para HDBSCAN
   - `umap_model.pkl` — 3 dimensiones, `n_neighbors=15`, `min_dist=0.1` → visualización y matching de hoteles

### Fase 4 — Clustering Óptimo

6. **ClusterOptimizer** (`src/clustering/optimizer.py`): Prueba `min_cluster_size ∈ {5, 10, 15, 20, 25}` sobre los embeddings 15D. Calcula silhouette score en cada iteración con **`save=False`** (no sobreescribe el pkl). Elige el óptimo y ejecuta el modelo definitivo con **`save=True`**.

### Fase 5 — Recluster (`POST /api/pipeline/recluster`)

7. **ClusterEngine** (`src/clustering/engine.py`): HDBSCAN con el `min_cluster_size` elegido. Devuelve etiquetas (-1 para ruido).
8. **ClusterProfiler** (`src/clustering/profiler.py`): Calcula métricas estadísticas por cluster (`adr`, `booking_leadtime`, `beach`, `mountain`, etc.). Genera nombres semánticos mediante **Vertex AI de forma secuencial** — cada llamada LLM recibe los nombres ya asignados a clusters anteriores para evitar duplicados. Nombres truncados a 5 palabras máximo. Almacena `centroid_3d` (las 3 coordenadas del centroide en el espacio UMAP 3D).

---

## 🎯 3. El Matchmaker — Proyección Inversa de Hoteles (`POST /api/hotels/project`)

**HotelMatcher** (`src/matching/hotel_matcher.py`) permite proyectar hasta 3 hoteles simultáneamente:

1. Construye un vector para el hotel rellenando las features disponibles del CSV (`STARS`, flags de tipo de destino, etc.) y poniendo a cero el resto.
2. Normaliza con el `StandardScaler` ya entrenado — usando `feature_names_in_` para garantizar alineación de columnas.
3. Proyecta con `umap_model.transform()` → coordenadas 3D.
4. **1 hotel**: busca los 3 clusters más cercanos por distancia euclidiana de centroides.
5. **N hoteles**: usa la distancia *máxima* de cada centroide a los N hoteles — elige los clusters con menor `max_distance` (intersección conservadora).
6. Devuelve `hotels[{id, name, coords_3d}]` y `affine_clusters[{cluster_id, cluster_name, cluster_size, distance}]`.

Las coordenadas `coords_3d` se almacenan en `nexusState.activeHotels` y se usan para posicionar el diamante del hotel en su coordenada UMAP real, tanto en la vista 3D (Plotly) como en la vista 2D (D3).

---

## 🤖 4. Explicabilidad Generativa (`POST /api/clusters/{id}/explain`)

**Explainer** (`src/clustering/explainer.py`):

1. `extract_dominant_features()`: Compara métricas del cluster vs. globales con umbrales fijos (±15–20%), construye un diccionario con las desviaciones significativas.
2. `generate_cluster_explanation()`: Envía los datos a Gemini con sistema de instrucciones específicas. El último bullet siempre es **"Recomendaciones generales para la campaña"** con Tono, Formato, Canal y Mejor momento de envío.
3. La respuesta se parsea de JSON limpiando fences markdown (```` ```json ````) y se cachea en `app.state.explanations_cache[(cluster_id, hotel_name)]`.

**Gestión de caché doble:**

| Nivel | Clave | Descripción |
|---|---|---|
| Backend | `(cluster_id, hotel_name)` | Persiste durante la sesión del servidor |
| Frontend | `"${cid}__${hotelIds}"` | `hotelIds` = IDs ordenados de hoteles activos, o `"none"` |

La clave compuesta en frontend garantiza que el resultado sin hotel no se sirve cuando hay un hotel activo.

**Pre-generación en background:** Tras cada recluster, `pregenerateExplanations()` llama silenciosamente a `/explain` para todos los clusters sin hotel, almacenando con clave `"${cid}__none"`.

---

## 🖥️ 5. Frontend SPA — Dos Vistas

### Vista 1 — Segmentación (`#view-segmentation`)

| Zona | Contenido |
|---|---|
| `sidebar-left` | Slider de granularidad + grid de hotel cards draggables |
| `canvas-center` | Tabs: Diagrama 2D (D3 burbujas) / Vista 3D (Plotly scatter) |
| `sidebar-right` | Upload de CSVs + Panel AI con resumen estático del cluster seleccionado |

**Flujo de interacción:**
- Clic en cluster (3D o 2D) → `dashboard.showClusterSummary()` — muestra ADR y leadtime sin llamada de red.
- Drag de hotel card al canvas → `handleProjectHotel()` → `nexusAPI.projectHotel()` → actualiza visualización y guarda `coords_3d`.
- Slider `input`: actualiza display en tiempo real. Slider `change`: dispara recluster.

### Vista 2 — Campañas (`#view-campaigns`)

Grid de tarjetas expandibles, una por cluster. Al expandir:
1. Comprueba caché (clave compuesta).
2. Si no hay caché: spinner → `nexusAPI.explainCluster(clusterId, hotelNames)` → bullets de Gemini.
3. Botón de exportar CSV por segmento.

---

## 📡 6. API Reference

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/upload/` | Sube `customers_csv` y `hotels_csv` a `data/raw/` |
| `POST` | `/api/pipeline/execute` | Ejecuta pipeline completo. Devuelve `{optimal_min_cluster_size, curve}` |
| `POST` | `/api/pipeline/recluster` | Clusteriza con `min_cluster_size` dado. Devuelve scatter data |
| `GET` | `/api/clusters/summary` | Lista de cluster cards con métricas y `centroid_3d` |
| `POST` | `/api/clusters/{id}/explain` | Genera bullets de marketing con Gemini (cacheado) |
| `GET` | `/api/clusters/{id}/export` | CSV de `GUEST_ID` del cluster |
| `GET` | `/api/clusters/debug/llm` | Diagnóstico de conectividad con Vertex AI |
| `GET` | `/api/hotels/` | Catálogo completo de hoteles del CSV |
| `POST` | `/api/hotels/project` | Proyecta 1–3 hoteles al espacio UMAP; devuelve `coords_3d` y clusters afines |

---

## 💾 7. Persistencia de Modelos

Los modelos se persisten en `models/` durante el primer pipeline y se reutilizan en operaciones posteriores:

```
models/
├── scaler.pkl           # StandardScaler (fit sobre datos de entrenamiento)
├── umap_model_15d.pkl   # UMAP 15D (solo para clustering interno)
├── umap_model.pkl       # UMAP 3D (visualización + transform de hoteles)
├── hdbscan_model.pkl    # Modelo HDBSCAN del último recluster válido
└── centroids.pkl        # Dict {cluster_id: centroid_3d_array}
```

> ⚠️ Los modelos son específicos del dataset con el que se entrenaron. Si se sube un CSV diferente, ejecuta `/api/pipeline/execute` para regenerarlos.

---

## 🚀 8. Roadmap

- **Escalabilidad:** Integración con bases de datos vectoriales nativas (Pinecone, Milvus) para datasets > 1M clientes.
- **Deploy en la nube:** Dockerfile preparado para Railway/GCP Cloud Run con autenticación mediante Service Account JSON inyectado como variable de entorno.
- **Personalización de prompts:** Panel admin para editar el system prompt de Gemini sin tocar código.
- **Segmentación temporal:** Comparativa de clusters entre períodos (Q1 vs Q4) para detectar cambios de comportamiento estacionales.
