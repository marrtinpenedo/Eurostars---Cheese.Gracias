# Módulo de Clustering — NEXUS

Agrupa a los clientes en segmentos naturales usando densidades (HDBSCAN) sobre proyecciones UMAP de alta dimensión.

## Componentes

### `engine.py` — ClusterEngine
Wrapper de HDBSCAN:
- `fit_predict(embeddings_15d, save=True)` — Ajusta el modelo y, si `save=True`, persiste `models/hdbscan_model.pkl`.
- El flag `save` permite al optimizador iterar sin sobreescribir el pkl en cada prueba.

### `optimizer.py` — ClusterOptimizer
Búsqueda del `min_cluster_size` óptimo:
- Prueba valores `{5, 10, 15, 20, 25}` con `save=False` (no escribe a disco en el loop).
- Evalúa calidad con **Silhouette Score** (ignora puntos de ruido, etiqueta -1).
- Re-ejecuta el ganador con `save=True` para persistir el modelo definitivo.

### `profiler.py` — ClusterProfiler
Genera el perfil descriptivo de cada cluster:
- Estadísticas: ADR, leadtime, preferencias (playa/montaña/gastronomía/patrimonio), país top, edad, género.
- **Naming LLM secuencial:** Llama a Gemini de forma secuencial (no paralela) para que cada nombre generado sea visible en el contexto de los nombres ya asignados, minimizando duplicados.
- Nombres truncados a **5 palabras** máximo.
- Almacena `centroid_3d` = centroide de los embeddings 3D del cluster (las 3 coordenadas completas).
- Post-deduplicación con `ensure_unique_names()` para garantizar unicidad.

### `explainer.py` — ClusterExplainer
Genera bullets de marketing con Vertex AI:
- Extrae features dominantes comparando métricas del cluster vs. globales (umbrales ±15–20%).
- El **último bullet** es siempre "Recomendaciones generales para la campaña" con Tono, Formato, Canal y Mejor momento de envío.
- Fallback: si el LLM falla, devuelve una recomendación genérica estática.
- Autenticación: intenta ADC de `gcloud` primero; si falla, intenta `GOOGLE_API_KEY`.
- Caché en backend con clave `(cluster_id, hotel_name)`.

## Formato de salida del Profiler

```json
{
  "cluster_id": 2,
  "name": "Viajero Urbano Frecuente",
  "size": 45,
  "metrics": {
    "adr": 187.3,
    "booking_leadtime": 22.1,
    "beach": 0.12,
    "mountain": 0.08,
    "gastronomy": 0.61,
    "heritage": 0.43,
    "top_country": "ES",
    "age_segment": "35-44",
    "stays": 3.2
  },
  "centroid_3d": [1.234, -0.567, 0.891]
}
```
