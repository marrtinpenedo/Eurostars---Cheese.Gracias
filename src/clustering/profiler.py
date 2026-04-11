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
    def generate_cluster_name(self, cluster_profile: dict, all_cluster_profiles: list[dict]) -> str:
        """
        Genera un nombre único para el cluster combinando el tipo de destino preferido
        y un diferenciador secundario (EDAD + ADR, o ADR + FRECUENCIA)
        """
        dest_scores = {
            'playa': cluster_profile.get('beach', 0),
            'montaña': cluster_profile.get('mountain', 0),
            'cultural': cluster_profile.get('heritage', 0),
            'gastronómico': cluster_profile.get('gastronomy', 0),
        }
        main_attr = max(dest_scores, key=dest_scores.get)
        
        prefixes = {
            'playa': 'Amante de playa',
            'montaña': 'Viajero de montaña',
            'cultural': 'Viajero cultural',
            'gastronómico': 'Viajero gastronómico',
        }
        base_name = prefixes[main_attr]

        siblings = [
            p for p in all_cluster_profiles
            if p['cluster_id'] != cluster_profile['cluster_id']
            and max({'playa': p['metrics'].get('beach', 0),
                     'montaña': p['metrics'].get('mountain', 0),
                     'cultural': p['metrics'].get('heritage', 0),
                     'gastronómico': p['metrics'].get('gastronomy', 0)},
                    key=lambda k: {'playa': p['metrics'].get('beach', 0),
                                    'montaña': p['metrics'].get('mountain', 0),
                                    'cultural': p['metrics'].get('heritage', 0),
                                    'gastronómico': p['metrics'].get('gastronomy', 0)}[k]) == main_attr
        ]

        if not siblings:
            return base_name

        adr = cluster_profile.get('adr', 0)
        global_adr = cluster_profile.get('global_avg_adr', adr) # injected temp
        if adr > global_adr * 1.3:
            adr_label = 'Premium'
        elif adr < global_adr * 0.7:
            adr_label = 'Económico'
        else:
            adr_label = 'Mid-range'

        age = cluster_profile.get('age_segment', -1)
        age_label = ''
        if 18 <= age <= 25: age_label = 'Joven'
        elif 26 <= age <= 35: age_label = 'Millennial'
        elif 36 <= age <= 50: age_label = 'Adulto'
        elif 51 <= age <= 65: age_label = 'Senior'
        elif age > 65: age_label = 'Senior+'

        if age_label:
            candidate = f"{base_name} · {age_label} {adr_label}"
        else:
            freq = cluster_profile.get('stays', 0)
            if freq > 5:
                freq_label = 'Frecuente'
            elif freq > 2:
                freq_label = 'Ocasional'
            else:
                freq_label = 'Esporádico'
            candidate = f"{base_name} · {adr_label} {freq_label}"

        return candidate

    def ensure_unique_names(self, cluster_profiles: list[dict]) -> list[dict]:
        name_counts = {}
        for profile in cluster_profiles:
            name = profile['name']
            if name in name_counts:
                name_counts[name] += 1
                profile['name'] = f"{name} {chr(64 + name_counts[name])}"
            else:
                name_counts[name] = 1
        return cluster_profiles

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
            
            p_metrics['global_avg_adr'] = global_stats['adr']
            
            profiles.append({
                "cluster_id": int(cluster_id),
                "name": "",
                "size": len(cluster_data),
                "metrics": p_metrics
            })
            
        for profile in profiles:
            # Pasa el dict de métricas planas para emular la interfaz requerida y tener el 'cluster_id' a mano
            temp_profile = profile['metrics'].copy()
            temp_profile['cluster_id'] = profile['cluster_id']
            profile['name'] = self.generate_cluster_name(temp_profile, profiles)
            
        profiles = self.ensure_unique_names(profiles)
            
        os.makedirs(self.models_dir, exist_ok=True)
        with open(self.centroids_path, "wb") as f:
            pickle.dump(centroids_3d, f)
            
        profiles.sort(key=lambda x: x["metrics"]["adr"], reverse=True)
        return profiles, global_stats
