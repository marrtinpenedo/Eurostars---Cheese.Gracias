# Módulo de Embeddings — NEXUS

Transforma la matriz de features numéricas en representaciones densas y la reduce a espacios de baja dimensión para clustering y visualización.

## Componentes

### `embedder.py` — FeatureEmbedder

Normalización de features con **StandardScaler** (media 0, varianza 1):

```python
scaled = embedder.fit_transform(stayprint_vector)  # nombre del atributo en app.state
```

- Persiste el scaler en `models/scaler.pkl` para reutilizarlo en la proyección inversa de hoteles.
- Al proyectar hoteles, recarga el scaler y usa `feature_names_in_` para alinear columnas correctamente.

### `reducer.py` — DimensionalityReducer

Entrena **dos modelos UMAP independientes** sobre los mismos datos escalados:

| Modelo | Dimensiones | Parámetros clave | Uso |
|---|---|---|---|
| `umap_model_15d.pkl` | 15D | `n_neighbors=15`, `min_dist=0.0` | Input para HDBSCAN (preserva estructura local) |
| `umap_model.pkl` | 3D | `n_neighbors=15`, `min_dist=0.1` | Visualización + `transform()` de hoteles |

El modelo 3D se usa tanto para el scatter plot como para proyectar hoteles con `umap.transform()`, garantizando que vivan en el mismo espacio que los clientes.

## Por qué UMAP en lugar de PCA / t-SNE

- **PCA**: solo captura varianza lineal global. Pierde relaciones no lineales entre comportamientos.
- **t-SNE**: preserva estructura local pero no la global; no soporta `transform()` en nuevos puntos (impide proyectar hoteles).
- **UMAP**: preserva estructura local *y* global; soporta `transform()`; escalable; permite el 15D intermedio para mejorar la calidad del clustering.
