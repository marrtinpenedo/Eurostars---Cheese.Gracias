# API FastAPI — NEXUS

El módulo `src/api/` expone toda la funcionalidad analítica del sistema como endpoints REST y sirve el frontend SPA desde el mismo proceso.

## Endpoints

| Método | Ruta | Módulo | Descripción |
|---|---|---|---|
| `POST` | `/api/upload/` | `upload.py` | Recibe `customers_csv` + `hotels_csv` y los guarda en `data/raw/` |
| `POST` | `/api/pipeline/execute` | `pipeline.py` | Pipeline completo: carga → features → UMAP → búsqueda granularidad óptima |
| `POST` | `/api/pipeline/recluster` | `pipeline.py` | HDBSCAN + profiling usando `min_cluster_size` del body |
| `GET` | `/api/clusters/summary` | `clusters.py` | Lista de cluster cards con métricas y `centroid_3d` |
| `POST` | `/api/clusters/{id}/explain` | `clusters.py` | Bullets de marketing generados por Gemini (cacheados en backend) |
| `GET` | `/api/clusters/{id}/export` | `clusters.py` | CSV de `GUEST_ID` del segmento |
| `GET` | `/api/clusters/debug/llm` | `clusters.py` | Prueba de conectividad con Vertex AI |
| `GET` | `/api/hotels/` | `hotels.py` | Catálogo completo de hoteles desde el CSV |
| `POST` | `/api/hotels/project` | `hotels.py` | Proyecta 1–3 hoteles al espacio UMAP; devuelve `coords_3d` y clusters afines |

## Estado en `app.state`

| Atributo | Tipo | Descripción |
|---|---|---|
| `customers_clean` | `DataFrame` | Clientes preprocesados |
| `hotels_clean` | `DataFrame` | Hoteles cargados |
| `stayprint_vector` | `DataFrame` | Matriz de features final —  `~100` columnas numéricas (nombre del atributo en `app.state`) |
| `embeddings_15d` | `ndarray` | Proyección UMAP 15D (para HDBSCAN) |
| `embeddings_3d` | `ndarray` | Proyección UMAP 3D (para viz y matching) |
| `cluster_labels` | `ndarray` | Etiquetas HDBSCAN por cliente |
| `cluster_cards` | `list[dict]` | Perfiles de clusters con `centroid_3d` |
| `explanations_cache` | `dict` | `{(cluster_id, hotel_name): [bullets]}` |

## Servidor

FastAPI con `StaticFiles` montado en `/` sirviendo `frontend/`. El `lifespan` carga los datos al arrancar si existen CSV en `data/raw/`. Puerto por defecto: **8000**.
