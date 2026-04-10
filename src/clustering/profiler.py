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

    def _extract_top_cat(self, df: pd.DataFrame, prefix: str) -> str:
        """Extrae la categoría dominante de columnas One-Hot."""
        cols = [c for c in df.columns if c.startswith(prefix)]
        if not cols: return "UNKNOWN"
        sums = df[cols].sum()
        if sums.max() == 0: return "UNKNOWN"
        best_col = sums.idxmax()
        return best_col.replace(prefix, "")

    def generate_profiles(self, original_df: pd.DataFrame, labels: np.ndarray, embeddings_3d: np.ndarray) -> tuple[list, dict]:
        """
        Calcula estadísticas por cluster y medias globales.
        Devuelve (profiles_list, global_stats_dict)
        """
        logger.info("Generando perfiles descriptivos por cluster...")
        profiles = []
        centroids_3d = {}
        
        df = original_df.copy()
        df["Cluster"] = labels
        
        # Calcular Global Stats
        global_stats = {
            "adr": float(df.get("CONFIRMED_RESERVATIONS_ADR", pd.Series([0])).mean()),
            "length_stay": float(df.get("AVG_LENGTH_STAY", pd.Series([0])).mean()),
            "booking_leadtime": float(df.get("AVG_BOOKING_LEADTIME", pd.Series([0])).mean()),
            "beach": float(df.get("CITY_BEACH_FLAG", pd.Series([0])).mean()),
            "mountain": float(df.get("CITY_MOUNTAIN_FLAG", pd.Series([0])).mean()),
            "heritage": float(df.get("CITY_HISTORICAL_HERITAGE", pd.Series([0])).mean()),
            "gastronomy": float(df.get("CITY_GASTRONOMY", pd.Series([0])).mean()),
            "stays": float(df.get("LAST_2_YEARS_STAYS", pd.Series([0])).mean())
        }
        
        unique_labels = sorted(set(labels))
        
        for cluster_id in unique_labels:
            if cluster_id == -1: continue
                
            mask = df["Cluster"] == cluster_id
            cluster_data = df[mask]
            
            # Centroide 3D
            pts_3d = embeddings_3d[mask]
            centroids_3d[cluster_id] = np.mean(pts_3d, axis=0)
            
            # Recolectar variables extensas
            age_mode = int(cluster_data["AGE_NUM"].mode().iloc[0]) if "AGE_NUM" in cluster_data.columns and not cluster_data["AGE_NUM"].mode().empty else -1
            peak_month = int(cluster_data["PEAK_MONTH"].mode().iloc[0]) if "PEAK_MONTH" in cluster_data.columns and not cluster_data["PEAK_MONTH"].mode().empty else 6
            top_country = self._extract_top_cat(cluster_data, "COUNTRY_GUEST_")
            
            p_metrics = {
                "age_segment": age_mode,
                "peak_month": peak_month,
                "top_country": top_country,
                "adr": round(float(cluster_data.get("CONFIRMED_RESERVATIONS_ADR", pd.Series([0])).mean()), 2),
                "length_stay": round(float(cluster_data.get("AVG_LENGTH_STAY", pd.Series([0])).mean()), 1),
                "booking_leadtime": round(float(cluster_data.get("AVG_BOOKING_LEADTIME", pd.Series([0])).mean()), 1),
                "beach": round(float(cluster_data.get("CITY_BEACH_FLAG", pd.Series([0])).mean()), 2),
                "mountain": round(float(cluster_data.get("CITY_MOUNTAIN_FLAG", pd.Series([0])).mean()), 2),
                "heritage": round(float(cluster_data.get("CITY_HISTORICAL_HERITAGE", pd.Series([0])).mean()), 2),
                "gastronomy": round(float(cluster_data.get("CITY_GASTRONOMY", pd.Series([0])).mean()), 2),
                "score": round(float(cluster_data.get("AVG_SCORE", pd.Series([0])).mean()), 1),
                "stays": round(float(cluster_data.get("LAST_2_YEARS_STAYS", pd.Series([0])).mean()), 1)
            }
            
            profiles.append({
                "cluster_id": int(cluster_id),
                "name": f"Segmento #{cluster_id}",
                "size": len(cluster_data),
                "metrics": p_metrics
            })
            
        os.makedirs(self.models_dir, exist_ok=True)
        with open(self.centroids_path, "wb") as f:
            pickle.dump(centroids_3d, f)
            
        profiles.sort(key=lambda x: x["metrics"]["adr"], reverse=True)
        return profiles, global_stats
