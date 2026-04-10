"""Endpoints relacionados con obtener métricas de proyección transversal de hoteles."""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import logging

from src.matching.hotel_matcher import HotelMatcher

logger = logging.getLogger(__name__)
router = APIRouter()

class HotelProjectRequest(BaseModel):
    hotel_id: str

from src.api.routes.clusters import explain_cluster, ExplainRequest

@router.post("/project")
def project_hotel(req: HotelProjectRequest, app_req: Request):
    """
    Busca el hotel analizado, lo proyecta hacia la topografía de clientes 3D,
    y determina a qué clusters es más probable impactar rentablemente.
    """
    hotels_df = getattr(app_req.app.state, "hotels_clean", None)
    if hotels_df is None:
        raise HTTPException(status_code=400, detail="Catálogo no procesado. Ejecuta /pipeline/execute.")
        
    hotel_id_padded = str(req.hotel_id).strip().zfill(3)
    
    if "ID" not in hotels_df.columns:
        raise HTTPException(status_code=500, detail="Memory error: Columna ID ausente en hotels_clean.")
        
    match = hotels_df[hotels_df["ID"] == hotel_id_padded]
    
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Hotel {hotel_id_padded} no listado.")
        
    hotel_serie = match.iloc[0]
    matcher = HotelMatcher()
    
    try:
        coords = matcher.project_hotel_to_embedding_space(hotel_serie)
        affine = matcher.get_affine_clusters_for_hotel(coords, top_n=3)
    except Exception as e:
        logger.error(f"Error projetando hotel {hotel_id_padded}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    hotel_name_str = str(hotel_serie.get("HOTEL_NAME", "Unknown"))
    
    # Formatear salida estructurada invocando explainer para la preview
    results_list = []
    
    cards = getattr(app_req.app.state, "cluster_cards", [])
    
    for a in affine:
        c_id = int(a[0])
        dist = float(a[1])
        
        # Encontrar datos base si existen
        c_card = next((c for c in cards if c["cluster_id"] == c_id), {})
        size = c_card.get("size", 0)
        
        # Obtener la explicacion síncronamente (usará caché si ya se pidió)
        try:
            ex_data = explain_cluster(c_id, ExplainRequest(hotel_name=hotel_name_str), app_req)
            preview = ex_data["bullets"][0] if ex_data.get("bullets") else "Ver detalles..."
            c_name = ex_data.get("cluster_name", f"Segmento #{c_id}")
        except Exception as e:
            preview = "Previa no disponible."
            c_name = f"Segmento #{c_id}"
            
        results_list.append({
            "cluster_id": c_id,
            "cluster_name": c_name,
            "cluster_size": size,
            "distance": round(dist, 3),
            "explanation_preview": preview
        })
        
    return {
        "hotel_name": hotel_name_str,
        "coords_3d": [float(x) for x in coords],
        "affine_clusters": results_list
    }

@router.get("/list")
def list_options(app_req: Request):
    """Lista de hoteles para nutrir el dropdown de la UI."""
    hotels_df = getattr(app_req.app.state, "hotels_clean", None)
    if hotels_df is None:
        return {"hotels": []}
        
    h_list = []
    for _, row in hotels_df.iterrows():
        h_list.append({
            "id": row["ID"],
            "name": row.get("HOTEL_NAME", f"Hotel {row['ID']}")
        })
    return {"hotels": h_list}
