"""Cruza perfil de cluster con hotel_data.csv para recomendar destinos óptimos."""
import numpy as np
import pandas as pd
import pickle
import os
import logging
from scipy.spatial.distance import cdist

logger = logging.getLogger(__name__)

class HotelMatcher:
    def __init__(self, models_dir: str = "models"):
        self.models_dir = models_dir
        self.scaler_path = os.path.join(self.models_dir, "scaler.pkl")
        self.umap_viz_path = os.path.join(self.models_dir, "umap_model.pkl")
        self.centroids_path = os.path.join(self.models_dir, "cluster_centroids.pkl")
        
    def _create_hotel_vector(self, hotel_series: pd.Series, expected_columns: list) -> pd.DataFrame:
        """
        Construye un vector con la misma dimension de variables que los clientes.
        Aquellas features ausentes se pondrán a 0.
        """
        vec = {col: 0.0 for col in expected_columns}
        
        # Mapeos numéricos directos presentes en hoteles
        direct_maps = ["STARS", "CITY_BEACH_FLAG", "CITY_MOUNTAIN_FLAG", 
                       "CITY_HISTORICAL_HERITAGE", "CITY_PRICE_LEVEL", "CITY_GASTRONOMY"]
        for col in direct_maps:
            if col in expected_columns and col in hotel_series:
                vec[col] = float(hotel_series[col])
                
        # OHE para climas
        if "CITY_CLIMATE" in hotel_series:
            climate_col = f"FAV_CLIMATE_{str(hotel_series['CITY_CLIMATE']).strip().upper()}"
            if climate_col in expected_columns:
                vec[climate_col] = 1.0
                
        # Para el resto (ADR, stays, gender, country) la red UMAP imputará el zero-vector 
        # asumiendo la línea base normalizada al cruzar esto por el Standard Scaler
        return pd.DataFrame([vec])

    def project_hotel_to_embedding_space(self, hotel_data: pd.Series) -> np.ndarray:
        """
        Vectoriza un hotel con sus características y lo proyecta 
        al espacio UMAP entrenado con clientes (visualización).
        """
        logger.info(f"Vectorizando y proyectando hotel en 3D...")
        with open(self.scaler_path, "rb") as f:
            scaler = pickle.load(f)
        with open(self.umap_viz_path, "rb") as f:
            umap_model = pickle.load(f)
            
        expected_cols = getattr(scaler, "feature_names_in_", None)
        if expected_cols is None:
            raise ValueError("Fallback: el scaler no tiene feature_names_in_ guardados.")
            
        hotel_df = self._create_hotel_vector(hotel_data, expected_cols.tolist())
        
        # Normalizar vector
        scaled_vec = scaler.transform(hotel_df)
        
        # Proyectar
        coords_3d = umap_model.transform(scaled_vec)
        return coords_3d[0] # Retorna [x, y, z]

    def get_affine_clusters_for_hotel(self, hotel_vector_3d: np.ndarray, top_n: int = 3) -> list:
        """
        Devuelve los top_n clusters (su ID y distancia) más cercanos al hotel proyectado.
        """
        if not os.path.exists(self.centroids_path):
            raise FileNotFoundError("Centroides no calculados. Ejecuta profiler.py primero.")
            
        with open(self.centroids_path, "rb") as f:
            centroids = pickle.load(f)
            
        if not centroids:
            return []
            
        # Preparar para distancias Euclidianas
        cluster_ids = list(centroids.keys())
        centroid_coords = np.array([centroids[c] for c in cluster_ids])
        
        h_vec = hotel_vector_3d.reshape(1, -1)
        distances = cdist(h_vec, centroid_coords, metric='euclidean')[0]
        
        # Juntar ID_del_cluster con su Distancia
        dist_records = [(cluster_ids[i], distances[i]) for i in range(len(cluster_ids))]
        dist_records.sort(key=lambda x: x[1])
        
        return dist_records[:top_n]
