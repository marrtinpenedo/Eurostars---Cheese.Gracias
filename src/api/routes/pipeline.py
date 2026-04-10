"""Endpoints para ejecutar el pipeline de procesamiento y clustering."""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import logging

from src.data.loader import DataLoader
from src.data.preprocessor import DataPreprocessor
from src.data.feature_builder import FeatureBuilder
from src.embeddings.embedder import FeatureEmbedder
from src.embeddings.reducer import DimensionalityReducer
from src.clustering.engine import ClusterEngine
from src.clustering.optimizer import ClusterOptimizer
from src.clustering.profiler import ClusterProfiler

logger = logging.getLogger(__name__)
router = APIRouter()

class ReclusterRequest(BaseModel):
    min_cluster_size: int

@router.post("/execute")
def execute_pipeline(request: Request):
    """
    Lee CSVs crudos, extrae vector de identidad, y calcula 
    los embeddings pesados UMAP. Guarda outputs en memoria para reclustering rápido.
    """
    logger.info("Iniciando reconstrucción total del pipeline...")
    loader = DataLoader("data/raw")
    try:
        c, h = loader.get_data()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Faltan archivos CSV.")
        
    preprocessor = DataPreprocessor()
    c_cl, h_cl = preprocessor.preprocess_customers(c), preprocessor.preprocess_hotels(h)
    
    request.app.state.hotels_clean = h_cl
    
    fb = FeatureBuilder()
    vec = fb.build_features(c_cl, h_cl)
    request.app.state.stayprint_vector = vec
    
    embedder = FeatureEmbedder()
    scaled = embedder.fit_transform(vec)
    
    reducer = DimensionalityReducer()
    e15, e3 = reducer.fit_transform(scaled)
    request.app.state.embeddings_15d = e15
    request.app.state.embeddings_3d = e3
    
    opt = ClusterOptimizer()
    res = opt.suggest_optimal_granularity(e15)
    
    return {"message": "Pipeline features+UMAP terminado.", "suggestion": res}

@router.post("/recluster")
def recluster(req: ReclusterRequest, app_req: Request):
    """
    Ejecuta HDBSCAN con el min_cluster_size elegido.
    Devuelve los datos de dispersión para Plotly y los tamaños de clusters.
    """
    e15 = getattr(app_req.app.state, "embeddings_15d", None)
    e3 = getattr(app_req.app.state, "embeddings_3d", None)
    vec = getattr(app_req.app.state, "stayprint_vector", None)
    
    if e15 is None: raise HTTPException(status_code=400, detail="Ejecuta /execute primero.")
    
    # 1. Clustering
    engine = ClusterEngine(min_cluster_size=req.min_cluster_size)
    labels = engine.fit_predict(e15)
    
    from sklearn.metrics import silhouette_score
    valid = labels != -1
    score = -1.0
    if len(set(labels[valid])) > 1:
        try:
            score = silhouette_score(e15, labels)
        except Exception: pass
        
    n_cl = len(set(labels[valid]))
    
    # 2. Perfilado y actualización de estado
    profiler = ClusterProfiler()
    cards, global_stats = profiler.generate_profiles(vec, labels, e3)
    
    app_req.app.state.cluster_cards = cards
    app_req.app.state.global_stats = global_stats
    app_req.app.state.labels = labels
    
    # 3. Payload de Visualización
    scatter = []
    for i in range(len(e3)):
        scatter.append({
            "x": float(e3[i][0]),
            "y": float(e3[i][1]),
            "z": float(e3[i][2]),
            "cluster": int(labels[i]),
            "guest_id": str(vec.index[i])
        })
        
    # 4. Optimizador base
    opt = ClusterOptimizer()
    res = opt.suggest_optimal_granularity(e15)
    
    sizes = [c["size"] for c in cards]
    
    return {
        "n_clusters": n_cl,
        "silhouette_score": float(score),
        "cluster_sizes": sizes,
        "scatter_data": scatter,
        "optimal_suggestion": res["optimal_min_cluster_size"]
    }
