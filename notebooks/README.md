# Cuadernos de Exploración (Notebooks) — NEXUS

Entorno de trabajo experimental para prototipado y análisis exploratorio. Los notebooks son independientes del servidor de producción.

## Contenido

| Notebook | Descripción |
|---|---|
| `01_eda.ipynb` | Análisis exploratorio de los CSV fuente: distribuciones, outliers, valores nulos |
| `02_feature_engineering.ipynb` | Prototipado del pipeline de features: join, agregaciones, One-Hot Encoding |
| `03_embeddings.ipynb` | Reducción dimensional: Standard Scaler + UMAP 15D + UMAP 3D |
| `04_clustering.ipynb` | Formación de clusters con HDBSCAN, evaluación con Silhouette Score |

## Notas

- Los notebooks **no** se deben usar en producción; la lógica validada aquí se porta a `src/`.
- Requieren los mismos paquetes que el servidor principal (`requirements.txt`).
- Para ejecutar localmente: `jupyter notebook notebooks/`
