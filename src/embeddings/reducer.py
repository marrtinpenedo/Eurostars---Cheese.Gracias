"""Reducción dimensional: UMAP 15D para clustering y 3D para visualización óptima."""
import numpy as np
import umap
import pickle
import os
import logging

logger = logging.getLogger(__name__)

class DimensionalityReducer:
    def __init__(self, models_dir: str = "models", random_state: int = 42):
        self.models_dir = models_dir
        self.random_state = random_state
        
        # UMAP para ayudar al clustering (15 dims)
        # Localizamos vecindades más grandes para que hdbscan identifique densidades lógicas
        self.reducer_cluster = umap.UMAP(
            n_neighbors=15,
            min_dist=0.0,
            n_components=15,
            random_state=self.random_state
        )
        
        # UMAP para la visualización en pantalla (3 dims)
        self.reducer_viz = umap.UMAP(
            n_neighbors=15,
            min_dist=0.1,
            n_components=3,
            random_state=self.random_state
        )
        
        self.umap_viz_path = os.path.join(self.models_dir, "umap_model.pkl") # Por defecto usamos este para visualización y matching
        self.umap_cluster_path = os.path.join(self.models_dir, "umap_cluster_model.pkl")

    def fit_transform(self, scaled_data: np.ndarray):
        """
        Entrena ambos modelos UMAP y devuelve las proyecciones.
        Guarda los modelos en disco para inferencia posterior (proyectar hoteles).
        """
        logger.info("Entrenando UMAP (15D) para clustering...")
        embeddings_15d = self.reducer_cluster.fit_transform(scaled_data)
        
        logger.info("Entrenando UMAP (3D) para visualización y matching...")
        embeddings_3d = self.reducer_viz.fit_transform(scaled_data)
        
        # Guardar en disco
        os.makedirs(self.models_dir, exist_ok=True)
        with open(self.umap_viz_path, "wb") as f:
            pickle.dump(self.reducer_viz, f)
            
        with open(self.umap_cluster_path, "wb") as f:
            pickle.dump(self.reducer_cluster, f)
            
        logger.info(f"Modelos UMAP guardados en {self.models_dir}/")
        
        return embeddings_15d, embeddings_3d

    def transform_viz(self, new_data: np.ndarray) -> np.ndarray:
        """
        Calcula la proyección 3D de nuevos datos (ej: el hotel)
        usando el UMAP previamente ajustado.
        """
        if not os.path.exists(self.umap_viz_path):
            raise FileNotFoundError("Modelo UMAP 3D no encontrado. Entrena primero.")
            
        with open(self.umap_viz_path, "rb") as f:
            loaded_umap = pickle.load(f)
            
        return loaded_umap.transform(new_data)
        
    def transform_cluster(self, new_data: np.ndarray) -> np.ndarray:
        """
        Calcula la proyección 15D de nuevos datos.
        """
        if not os.path.exists(self.umap_cluster_path):
            raise FileNotFoundError("Modelo UMAP 15D no encontrado. Entrena primero.")
            
        with open(self.umap_cluster_path, "rb") as f:
            loaded_umap = pickle.load(f)
            
        return loaded_umap.transform(new_data)
