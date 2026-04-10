"""FastAPI app principal. Punto de entrada de la API web."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from src.api.routes import upload, pipeline, clusters, hotels

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cargar datos base si existen para no abrir disco en cada petición
    from src.data.loader import DataLoader
    from src.data.preprocessor import DataPreprocessor
    try:
        logger.info("Intentando cargar CSVs en memoria...")
        loader = DataLoader("data/raw")
        c, h = loader.get_data()
        preprocessor = DataPreprocessor()
        app.state.customers_clean = preprocessor.preprocess_customers(c)
        app.state.hotels_clean = preprocessor.preprocess_hotels(h)
        logger.info("Datos cargados correctamente en app.state.")
    except Exception as e:
        logger.warning(f"No se pudieron cargar los datos iniciales. Probablemente aún no se han subido. Error: {e}")
        app.state.customers_clean = None
        app.state.hotels_clean = None
    
    # Podríamos cargar los modelos UMAP/HDBSCAN aquí también,
    # pero como las clases ya gestionan su apertura o NotFound, nos limitaremos a los datos.
    yield
    # Cleanup si hubiese


app = FastAPI(title="Stayprint API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["Pipeline"])
app.include_router(clusters.router, prefix="/api/clusters", tags=["Clusters"])
app.include_router(hotels.router, prefix="/api/hotels", tags=["Hotels"])

@app.get("/")
def root():
    return {"status": "STAYPRINT Engine Online"}
