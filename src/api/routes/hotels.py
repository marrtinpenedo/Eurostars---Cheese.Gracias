"""Endpoints relacionados con obtener métricas de proyección transversal de hoteles."""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import logging

from src.matching.hotel_matcher import HotelMatcher

logger = logging.getLogger(__name__)
router = APIRouter()

class HotelProjectRequest(BaseModel):
    hotel_id: str

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
        
    return {
        "hotel_name": str(hotel_serie.get("HOTEL_NAME", "Unknown")),
        "coords_3d": [float(x) for x in coords],
        "affine_clusters": [int(a[0]) for a in affine],
        "cluster_distances": [float(a[1]) for a in affine]
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
