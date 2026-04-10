"""Lógica para sugerir y afinar el número óptimo de clusters (ej. validación por scores de silueta)."""
import numpy as np
from sklearn.metrics import silhouette_score
import logging
from .engine import ClusterEngine

logger = logging.getLogger(__name__)

class ClusterOptimizer:
    def __init__(self, models_dir: str = "models", range_min_size: list = [5, 10, 15, 20, 25]):
        self.models_dir = models_dir
        self.range_min_size = range_min_size

    def suggest_optimal_granularity(self, embeddings_15d: np.ndarray) -> dict:
        """
        Prueba múltiples valores de min_cluster_size,
        calcula silhouette score para cada uno,
        devuelve el valor óptimo y la curva completa.
        """
        logger.info("Iniciando búsqueda de granularidad óptima...")
        results = []
        best_score = -1.0
        best_size = self.range_min_size[0]

        for size in self.range_min_size:
            # Instanciamos un motor por cada tamaño, evitamos escribir a disco constantemente 
            # (sobreescribiremos con el mejor al final si queremos, pero engine ya hace dump)
            engine = ClusterEngine(models_dir=self.models_dir, min_cluster_size=size)
            labels = engine.fit_predict(embeddings_15d)
            
            # Identificamos el número de clusters reales ignorando el ruido (-1)
            valid_mask = labels != -1
            n_clusters = len(set(labels[valid_mask]))
            
            if n_clusters > 1:
                # El silhouette lo calculamos sobre todo el dataset
                try:
                    score = silhouette_score(embeddings_15d, labels)
                except Exception:
                    score = -1.0
            else:
                score = -1.0
                
            results.append({
                "min_cluster_size": size,
                "n_clusters": n_clusters,
                "silhouette_score": float(score)
            })
            
            if score > best_score:
                best_score = score
                best_size = size

        logger.info(f"Óptimo encontrado: min_cluster_size={best_size} con {best_score} score")
        
        # Volveríamos a ejecutar el mejor para dejar este guardado como el definitivo en hdbscan_model.pkl
        best_engine = ClusterEngine(models_dir=self.models_dir, min_cluster_size=best_size)
        best_engine.fit_predict(embeddings_15d)
        
        return {
            "optimal_min_cluster_size": best_size,
            "best_silhouette_score": float(best_score),
            "curve": results
        }
