"""
explainer.py

Genera explicaciones humanizadas de cada cluster en dos pasos:
1. Extrae los atributos más distintivos del cluster vs. el resto (reglas)
2. Llama a OpenAI gpt-4o-mini para redactarlos como bullet points en lenguaje natural y generar un nombre.
"""

import os
from dotenv import load_dotenv
from openai import OpenAI
import json
import logging
from typing import Optional

# Cargar .env explícitamente con ruta absoluta para evitar problemas de CWD
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

def get_openai_client() -> OpenAI:
    """
    Inicializa el cliente OpenAI leyendo la key del entorno.
    Lanza error descriptivo si no encuentra la key.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY no encontrada. "
            "Asegúrate de que existe un fichero .env en la raíz del proyecto "
            "con la línea: OPENAI_API_KEY=sk-... (sin comillas)"
        )
    if api_key.startswith('"') or api_key.startswith("'"):
        raise RuntimeError(
            "OPENAI_API_KEY tiene comillas. "
            "Edita el .env y elimina las comillas alrededor del valor."
        )
    return OpenAI(api_key=api_key)

logger = logging.getLogger(__name__)

def extract_dominant_features(cluster_id: int, cluster_profiles: list, global_stats: dict) -> dict:
    """
    Compara el perfil del cluster con las medias globales.
    Devuelve los atributos donde el cluster se desvía fuertemente de la media global, 
    además de mantener datos geográficos puros.
    """
    c_data = next((c for c in cluster_profiles if c["cluster_id"] == cluster_id), None)
    if not c_data:
        return {}
        
    m = c_data["metrics"]
    diffs = {}
    
    # Textuales estáticos (no se comparan)
    diffs["age_segment"] = f"{m['age_segment']} años"
    diffs["peak_month"] = f"Mes {m['peak_month']} del año"
    diffs["top_country"] = str(m.get('top_country', 'Varios'))
    
    # Reglas lógicas de desviación sobre globals
    # ADR
    adr_diff = (m['adr'] - global_stats['adr']) / global_stats['adr'] if global_stats['adr'] else 0
    if adr_diff > 0.15: diffs["adr_level"] = f"alto (€{m['adr']} vs €{global_stats['adr']} media global)"
    elif adr_diff < -0.15: diffs["adr_level"] = f"económico (€{m['adr']} vs €{global_stats['adr']})"
    else: diffs["adr_level"] = f"medio (€{m['adr']})"
        
    # Leadtime
    lt_diff = (m['booking_leadtime'] - global_stats['booking_leadtime']) / global_stats['booking_leadtime'] if global_stats['booking_leadtime'] else 0
    if lt_diff > 0.2: diffs["booking_style"] = f"planificador ({m['booking_leadtime']} días de antelación)"
    elif lt_diff < -0.2: diffs["booking_style"] = f"espontáneo ({m['booking_leadtime']} días de antelación)"
    
    # Preferencias top (si la métrica > 0.5 asumimos que ese destino les gusta marcadamente)
    prefs = []
    if m['beach'] > 0.4: prefs.append("playa")
    if m['mountain'] > 0.4: prefs.append("montaña")
    if m['heritage'] > 0.4: prefs.append("histórico")
    if m['gastronomy'] > 0.4: prefs.append("gastronomía")
    if prefs:
        diffs["destination_preference"] = " + ".join(prefs)
        
    # Loyalty / Stays
    stays_diff = (m['stays'] - global_stats['stays']) / global_stats['stays'] if global_stats['stays'] else 0
    if stays_diff > 0.2: diffs["loyalty"] = f"alta fidelidad ({m['stays']} estancias)"
    elif stays_diff < -0.2: diffs["loyalty"] = f"viajero ocasional ({m['stays']} estancias)"
        
    return diffs

def generate_cluster_explanation(dominant_features: dict, cluster_size: int, hotel_name: Optional[str] = None) -> list[str]:
    """
    Llama a OpenAI gpt-4o-mini con los atributos dominantes del cluster
    y devuelve bullet points en lenguaje natural y nombre del cluster.
    """
    try:
        client = get_openai_client()
        
        hotel_context = f"\\nEste segmento ha sido identificado como altamente afín y predispuesto a reservar en el hotel: {hotel_name}." if hotel_name else ""
        user_prompt = f"""Describe creativamente a este segmento de clientes en bullet points.{hotel_context}

Datos del segmento ({cluster_size} clientes, sus desvíos vs media):
{json.dumps(dominant_features, indent=2, ensure_ascii=False)}

Devuelve estrictamente un array JSON plano de strings. El PRIMER elemento debe ser un Título creativo para el cluster (ej: "🚀 Viajero Urbano Premium"), los siguientes hasta 5 elementos serán los bullets puros donde cada uno empieza con un emoji relevante, sin tecnicismos y muy vendedor para marketing."""

        response = client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": "Eres un director analista de marketing hotelero. Devuelve ÚNICAMENTE un array JSON válido de strings sin bloque markdown ni texto extra."},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=400
        )
        
        raw_output = response.choices[0].message.content.strip()
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:-3].strip()
        elif raw_output.startswith("```"):
            raw_output = raw_output[3:-3].strip()
            
        bullets = json.loads(raw_output)
        return bullets if isinstance(bullets, list) else []
        
    except Exception as e:
        logger.error(f"Error llamando a OpenAI: {e}")
        return [f"⚠️ Error generando explicación: {e}"]

def get_full_explanation(
    cluster_id: int,
    cluster_profiles: list,
    global_stats: dict,
    hotel_name: Optional[str] = None
) -> dict:
    """
    Función principal que orquesta extract_dominant_features + generate_cluster_explanation.
    """
    c_data = next((c for c in cluster_profiles if c["cluster_id"] == cluster_id), {})
    size = c_data.get("size", 0)
    rule_based_name = c_data.get("name", f"Segmento #{cluster_id}")
    
    dominant_features = extract_dominant_features(cluster_id, cluster_profiles, global_stats)
    bullets = generate_cluster_explanation(dominant_features, size, hotel_name)
    
    cluster_name = rule_based_name
    if bullets and not str(bullets[0]).startswith("⚠️") and not str(bullets[0]).startswith("Reemplaza"):
        cluster_name = bullets.pop(0)
    
    if not bullets:
        bullets = ["Sin descripción detallada. (OpenAI inactivo)"]
        
    return {
        "cluster_id": cluster_id,
        "cluster_name": cluster_name,
        "cluster_size": size,
        "hotel_context": hotel_name,
        "bullets": bullets,
        "dominant_features": dominant_features
    }
