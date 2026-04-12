# NEXUS — Plataforma de Segmentación Analítica

**Impacthon 2026 · Eurostars Hotel Company**

> *"No te conocemos por tu perfil, sino por tu historia."*

**NEXUS** es una herramienta de segmentación de clientes hoteleros basada en embeddings e hiperpersonalización.  
Construye un vector de identidad de viaje a partir del comportamiento histórico de cada cliente y lo proyecta en un espacio tridimensional que permite detectar grupos naturales (clusters) y alinearlos con el catálogo de hoteles de Eurostars.

---

## 🚀 Setup Rápido (3 Pasos)

### 1. Instalar dependencias

```bash
pip install -r requirements.txt
```

> Se requiere Python 3.12+. Se recomienda trabajar dentro de un `venv`.

### 2. Configurar entorno (Google Cloud Vertex AI)

Copia la plantilla y edita los valores:

```bash
cp .env.example .env
```

Variables obligatorias en `.env`:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | ID del proyecto GCP | `eurostars-493004` |
| `VERTEX_LOCATION` | Región de Vertex AI | `us-central1` |
| `VERTEX_MODEL` | Modelo Gemini a usar | `gemini-2.5-flash-lite` |
| `API_HOST` | Host del servidor | `0.0.0.0` |
| `API_PORT` | Puerto del servidor | `8000` |

**Autenticación local (Application Default Credentials):**

```bash
gcloud auth application-default login
```

### 3. Arrancar el servidor

```bash
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
# Accede a http://localhost:8000
```

---

## 🎭 Demo Rápida

Si ya tienes los CSVs de muestra en `data/raw/`, pulsa el botón **"Cargar Demo"** directamente en la interfaz — no hace falta subir ficheros manualmente.

### Guión de la Demo

1. Abre **http://localhost:8000**.
2. Pulsa **"Cargar Demo"** (o sube tus propios CSV en el panel derecho y haz clic en **"Analizar clientes"**).
3. El sistema ejecuta el pipeline completo: carga → feature engineering → UMAP → HDBSCAN.
4. Aparece el **Diagrama 2D** con los clusters como burbujas coloreadas. Cambia a **Vista 3D** con Plotly para orbitar el espacio.
5. Ajusta el slider **"Personalización–Generalización"** para modificar la granularidad de los segmentos.
6. En el panel izquierdo, arrastra un hotel (p.ej. *Eurostars Torre Sevilla*) al espacio central.
7. El sistema proyecta el hotel en el espacio UMAP: los clusters afines se iluminan y el diamante aparece en su posición matemática real.
8. Haz clic en un cluster iluminado → el panel derecho muestra el resumen estadístico del segmento.
9. Pulsa **"Ver campañas sugeridas"** → Vista de Campañas con tarjetas expandibles. Al abrir una tarjeta, Vertex AI genera bullets de marketing con tono, canal y momento de envío recomendados.
10. Exporta cualquier segmento como CSV con los `GUEST_ID` para tu herramienta de email marketing.

---

## 📁 Estructura del Proyecto

```
.
├── data/
│   ├── raw/                    # CSVs fuente (customer_data_*.csv, hotel_data.csv)
│   └── processed/              # Artefactos intermedios (no versionados)
├── frontend/
│   ├── index.html              # SPA - Shell HTML
│   └── assets/
│       ├── css/style.css       # Sistema de diseño completo
│       └── js/
│           ├── main.js         # Orquestador SPA y estado global (nexusState)
│           ├── api.js          # Cliente HTTP (nexusAPI)
│           ├── dashboard.js    # Lógica de UI y controles
│           ├── viz3d.js        # Scatter 3D con Plotly
│           └── viz2d.js        # Diagrama de burbujas 2D con D3
├── models/                     # Modelos serializados (.pkl) — generados en runtime
│   ├── scaler.pkl
│   ├── umap_model.pkl          # UMAP 3D (visualización + matching)
│   ├── umap_model_15d.pkl      # UMAP 15D (clustering)
│   ├── hdbscan_model.pkl
│   └── centroids.pkl
├── notebooks/                  # Exploración y prototipado
├── src/
│   ├── api/
│   │   ├── main.py             # FastAPI app + lifespan + montaje de estáticos
│   │   └── routes/
│   │       ├── upload.py       # POST /api/upload/
│   │       ├── pipeline.py     # POST /api/pipeline/execute y /recluster
│   │       ├── clusters.py     # GET/POST /api/clusters/...
│   │       └── hotels.py       # GET /api/hotels/ y POST /api/hotels/project
│   ├── clustering/
│   │   ├── engine.py           # HDBSCAN wrapper (fit_predict con save opcional)
│   │   ├── optimizer.py        # Búsqueda de min_cluster_size óptimo (silhouette)
│   │   ├── profiler.py         # Estadísticas por cluster + naming LLM secuencial
│   │   └── explainer.py        # Explicabilidad Gemini (bullets + recomendaciones)
│   ├── data/
│   │   ├── loader.py           # Carga y tipado de CSVs
│   │   ├── preprocessor.py     # Limpieza y mapeo ordinal
│   │   └── feature_builder.py  # Vector NEXUS (join + OHE + agregación)
│   ├── embeddings/
│   │   ├── embedder.py         # StandardScaler
│   │   └── reducer.py          # UMAP 15D + UMAP 3D
│   └── matching/
│       └── hotel_matcher.py    # Proyección inversa de hoteles y cálculo de afinidad
├── tests/
├── .env                        # Variables de entorno (no versionado)
├── .env.example                # Plantilla de configuración
└── requirements.txt
```

---

## 🔐 Seguridad y Privacidad

- Todo el procesamiento de ML ocurre localmente (on-premise).
- Las exportaciones CSV solo contienen `GUEST_ID` (identificadores anónimos), sin PII.
- El único dato que sale al exterior son las peticiones a Vertex AI (estadísticas agregadas del cluster, nunca datos individuales de clientes).
