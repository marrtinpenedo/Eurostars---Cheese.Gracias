"""
explainer.py

Genera explicaciones humanizadas de cada cluster en dos pasos:
1. Extrae los atributos más distintivos del cluster vs. el resto (reglas)
2. Llama a OpenAI gpt-4o-mini para redactarlos como bullet points en lenguaje natural y generar un nombre.
"""

import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
import json
import logging
from typing import Optional

# Cargar .env explícitamente con ruta absoluta para evitar problemas de CWD
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

def get_genai_client() -> genai.Client:
    """
    Inicializa el cliente de Google GenAI leyendo el proyecto y location de entorno (ADC).
    """
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("VERTEX_LOCATION")
    if not project or not location:
        raise RuntimeError(
            "Faltan variables GOOGLE_CLOUD_PROJECT o VERTEX_LOCATION en el archivo .env."
        )
    return genai.Client(vertexai=True, project=project, location=location)

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

def generate_cluster_explanation(dominant_features: dict, cluster_size: int, cluster_name: str, hotel_name: Optional[str] = None) -> list[str]:
    """
    Llama a OpenAI gpt-4o-mini con los atributos dominantes del cluster
    y devuelve bullet points en lenguaje natural.
    """
    try:
        client = get_genai_client()
        
        hotel_context = f"\nEste segmento ha sido identificado como afín al hotel {hotel_name}." if hotel_name else ""
        user_prompt = f"""Describe el segmento llamado "{cluster_name}" ({cluster_size} clientes) en bullet points.{hotel_context}

Datos:
{json.dumps(dominant_features, indent=2, ensure_ascii=False)}

IMPORTANTE: El nombre del segmento es "{cluster_name}". 
Tu descripción debe ser coherente con ese nombre.
Devuelve solo una lista JSON de strings."""

        response = client.models.generate_content(
            model=os.environ.get("VERTEX_MODEL", "gemini-2.5-flash"),
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction="Eres un director analista de marketing hotelero. Devuelve ÚNICAMENTE un array JSON válido de strings sin bloque markdown ni texto extra.",
                temperature=0.7,
                response_mime_type="application/json"
            )
        )
        
        raw_output = response.text.strip()
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:-3].strip()
        elif raw_output.startswith("```"):
            raw_output = raw_output[3:-3].strip()
            
        try:
            bullets = json.loads(raw_output)
            return bullets if isinstance(bullets, list) else []
        except json.JSONDecodeError as je:
            logger.error(f"Fallo al parsear JSON: {je} - Salida del LLM: {raw_output}")
            return [f"⚠️ Error generando explicación: {je}", f"Texto crudo LLM: {raw_output}"]
        
    except Exception as e:
        logger.error(f"Error llamando a LLM: {e}")
        return [f"⚠️ Error al conectar con LLM: {e}"]

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
    cluster_name = c_data.get("name", f"Segmento #{cluster_id}")
    
    dominant_features = extract_dominant_features(cluster_id, cluster_profiles, global_stats)
    bullets = generate_cluster_explanation(dominant_features, size, cluster_name, hotel_name)
    
    if not bullets:
        bullets = ["Sin descripción detallada. (LLM inactivo)"]
        
    return {
        "cluster_id": cluster_id,
        "cluster_name": cluster_name,
        "cluster_size": size,
        "hotel_context": hotel_name,
        "bullets": bullets,
        "dominant_features": dominant_features
    }
