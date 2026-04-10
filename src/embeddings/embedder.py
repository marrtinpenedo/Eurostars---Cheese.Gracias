"""Generación de embeddings por cliente a partir de su matriz de historia."""
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import pickle
import os
import logging

logger = logging.getLogger(__name__)

class FeatureEmbedder:
    def __init__(self, models_dir: str = "models"):
        self.models_dir = models_dir
        self.scaler = StandardScaler()
        self.scaler_path = os.path.join(self.models_dir, "scaler.pkl")

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        Ajusta el scaler y transforma los datos.
        Guarda el scaler para la inferencia de hoteles.
        """
        logger.info("Normalizando las features del vector histórico...")
        scaled_data = self.scaler.fit_transform(df)
        
        # Guardar el scaler
        os.makedirs(self.models_dir, exist_ok=True)
        with open(self.scaler_path, "wb") as f:
            pickle.dump(self.scaler, f)
        logger.info(f"Scaler guardado en {self.scaler_path}")
        
        return scaled_data

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        Transforma nuevos datos (ej. un hotel) usando el scaler pre-entrenado.
        """
        if not os.path.exists(self.scaler_path):
            raise FileNotFoundError("Scaler no encontrado. Entrena primero.")
            
        with open(self.scaler_path, "rb") as f:
            loaded_scaler = pickle.load(f)
            
        return loaded_scaler.transform(df)
