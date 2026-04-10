"""Algoritmo principal de clustering (HDBSCAN)."""
import hdbscan
import pickle
import os
import logging
import numpy as np

logger = logging.getLogger(__name__)

class ClusterEngine:
    def __init__(self, models_dir: str = "models", min_cluster_size: int = 15):
        self.models_dir = models_dir
        self.min_cluster_size = min_cluster_size
        self.model_path = os.path.join(self.models_dir, "hdbscan_model.pkl")
        self.model = None

    def fit_predict(self, embeddings_15d: np.ndarray) -> np.ndarray:
        """
        Ajusta HDBSCAN sobre los embeddings 15D y devuelve las etiquetas.
        """
        logger.info(f"Entrenando HDBSCAN con min_cluster_size={self.min_cluster_size}...")
        self.model = hdbscan.HDBSCAN(
            min_cluster_size=self.min_cluster_size,
            min_samples=1, 
            gen_min_span_tree=True,
            prediction_data=True
        )
        
        labels = self.model.fit_predict(embeddings_15d)
        
        # Guardar el modelo en disco
        os.makedirs(self.models_dir, exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump(self.model, f)
        logger.info(f"Modelo HDBSCAN guardado en {self.model_path}")
        
        return labels

    def load_model(self):
        """Carga el modelo persistido."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError("Modelo HDBSCAN no encontrado.")
        with open(self.model_path, "rb") as f:
            self.model = pickle.load(f)
        return self.model
