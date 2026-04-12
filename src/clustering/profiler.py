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
        return sums.idxmax().replace(prefix, "")

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
                "metrics": p_metrics,
                "centroid_2d": [float(centroids_3d[cluster_id][0]), float(centroids_3d[cluster_id][1])]
            })
            
        from src.clustering.explainer import get_genai_client
        genai_client = get_genai_client()
        
        import concurrent.futures
        
        def fetch_name(profile):
            temp_profile = profile['metrics'].copy()
            temp_profile['cluster_id'] = profile['cluster_id']
            temp_profile['cluster_size'] = profile['size']
            # Pasamos todos los perfiles a cada hilo para que el LLM tenga el contexto
            # El método extrae sus 'metrics' ignorando si ya tienen 'name' o no.
            name = self.generate_cluster_name_with_llm(
                cluster_profile=temp_profile,
                all_cluster_profiles=profiles,
                genai_client=genai_client
            )
            return profile['cluster_id'], name

        named_profiles = profiles.copy()
        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
            futures = [executor.submit(fetch_name, p) for p in profiles]
            for future in concurrent.futures.as_completed(futures):
                c_id, name = future.result()
                for p in named_profiles:
                    if p['cluster_id'] == c_id:
                        p['name'] = name
                        break
            
        profiles = self.ensure_unique_names(named_profiles)
            
        os.makedirs(self.models_dir, exist_ok=True)
        with open(self.centroids_path, "wb") as f:
            pickle.dump(centroids_3d, f)
            
        profiles.sort(key=lambda x: x["metrics"]["adr"], reverse=True)
        return profiles, global_stats

    def generate_cluster_name_with_llm(self, cluster_profile: dict, all_cluster_profiles: list[dict], genai_client) -> str:
        """
        Genera un nombre único y descriptivo para el cluster usando la API
        """
        other_clusters_summary = []
        for p in all_cluster_profiles:
            other_clusters_summary.append({
                'id': p['cluster_id'],
                'age': p['metrics'].get('age_segment'),
                'adr': p['metrics'].get('adr'),
                'frequency': p['metrics'].get('stays'),
                'leadtime': p['metrics'].get('booking_leadtime'),
                'countries': str(p['metrics'].get('top_country', ''))
            })
            
        system_prompt = """Eres un experto en marketing hotelero. 
Tu tarea es asignar nombres únicos y descriptivos a segmentos de clientes.
Cada nombre debe tener entre 3 y 5 palabras en español.
CRÍTICO: El nombre debe ser DIFERENTE a todos los nombres de otros segmentos proporcionados.
Responde ÚNICAMENTE con el nombre, sin explicación, sin comillas, sin puntuación final."""

        user_prompt = f"""Asigna un nombre único a este segmento de clientes hoteleros.

SEGMENTO A NOMBRAR:
- Rango de edad dominante: {cluster_profile.get('age_segment', 'desconocido')}
- ADR medio: €{cluster_profile.get('adr', 0):.0f}
- Destino preferido: playa={cluster_profile.get('beach', 0):.2f}, montaña={cluster_profile.get('mountain', 0):.2f}, heritage={cluster_profile.get('heritage', 0):.2f}, gastronomía={cluster_profile.get('gastronomy', 0):.2f}
- Reservas confirmadas media: {cluster_profile.get('stays', 0):.1f}
- Antelación media reserva: {cluster_profile.get('booking_leadtime', 0):.0f} días
- Países de origen top: {cluster_profile.get('top_country', '')}
- Duración media estancia: {cluster_profile.get('length_stay', 0):.1f} noches
- Nº clientes: {cluster_profile.get('cluster_size', 0)}

OTROS SEGMENTOS YA NOMBRADOS (el tuyo DEBE ser diferente a todos estos):
{other_clusters_summary}

Responde solo con el nombre (3-5 palabras en español):"""

        try:
            from google.genai import types
            model_name = os.environ.get("VERTEX_MODEL", "gemini-2.5-flash")
            response = genai_client.models.generate_content(
                model=model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7
                )
            )
            name = response.text.strip().strip('"').strip("'")
            return name
        except Exception as e:
            logger.error(f"Error LLM Nombre Cluster: {e}")
            return f"Segmento {cluster_profile['cluster_id']}"
