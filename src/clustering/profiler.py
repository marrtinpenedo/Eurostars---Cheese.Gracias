"""Genera el perfil descriptivo e interpretable de cada cluster encontrado."""
import pandas as pd
import numpy as np
import pickle
import os
import logging

logger = logging.getLogger(__name__)

class ClusterProfiler:
    def __init__(self, models_dir: str = "models"):
        self.models_dir = models_dir
        self.centroids_path = os.path.join(self.models_dir, "cluster_centroids.pkl")

    def generate_profiles(self, original_df: pd.DataFrame, labels: np.ndarray, embeddings_3d: np.ndarray) -> list:
        """
        Calcula las estadísticas para cada cluster (ignorando el ruido -1).
        Aprovecha para calcular y guardar los centroides 3D.
        Devuelve una lista de diccionarios que la app/API consumirá para pintar las cards.
        """
        logger.info("Generando perfiles descriptivos por cluster...")
        profiles = []
        centroids_3d = {}
        
        # Trabajamos sobre una copia con el label asignado
        df = original_df.copy()
        df["Cluster"] = labels
        
        unique_labels = sorted(set(labels))
        
        for cluster_id in unique_labels:
            if cluster_id == -1:
                continue # Omitir ruido
                
            mask = df["Cluster"] == cluster_id
            cluster_data = df[mask]
            
            # Calcular centroide 3D para este cluster (media geométrica en UMAP 3D)
            pts_3d = embeddings_3d[mask]
            centroid = np.mean(pts_3d, axis=0)
            centroids_3d[cluster_id] = centroid
            
            # Recolectar variables descriptivas del cluster
            # (asumiendo que recibimos el stayprint_vector o el feature engineering final)
            
            # Edades, si están mapeadas, las podemos resumir con su moda
            age_mode = -1
            if "AGE_NUM" in cluster_data.columns:
                age_mode = cluster_data["AGE_NUM"].mode()
                age_mode = age_mode.iloc[0] if not age_mode.empty else -1
                
            # ADR y Score
            adr = cluster_data.get("CONFIRMED_RESERVATIONS_ADR", pd.Series([0])).mean()
            score = cluster_data.get("AVG_SCORE", pd.Series([0])).mean()
            
            profiles.append({
                "cluster_id": int(cluster_id),
                "name": f"Segmento #{cluster_id}",
                "size": len(cluster_data),
                "metrics": {
                    "adr": round(float(adr), 2),
                    "score": round(float(score), 1),
                    "age_segment": int(age_mode)
                }
            })
            
        # Guardar centroides
        os.makedirs(self.models_dir, exist_ok=True)
        with open(self.centroids_path, "wb") as f:
            pickle.dump(centroids_3d, f)
            
        logger.info(f"Se crearon {len(profiles)} perfiles y se guardaron los centroides 3D.")
        
        # Ordenar por ADR descendente como pidió el usuario para la UI
        profiles.sort(key=lambda x: x["metrics"]["adr"], reverse=True)
        
        return profiles
