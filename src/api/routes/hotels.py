"""Endpoints relacionados con obtener métricas de proyección transversal de hoteles."""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import logging

from src.matching.hotel_matcher import HotelMatcher

logger = logging.getLogger(__name__)
router = APIRouter()

class HotelProjectRequest(BaseModel):
    hotel_ids: list[str]

from src.api.routes.clusters import explain_cluster, ExplainRequest

@router.post("/project")
def project_hotel(req: HotelProjectRequest, app_req: Request):
    """
    Busca los hoteles analizados, los proyecta hacia la topografía de clientes 3D,
    y determina a qué clusters es más probable impactar rentablemente en forma condicional (intersección).
    """
    hotels_df = getattr(app_req.app.state, "hotels_clean", None)
    if hotels_df is None:
        raise HTTPException(status_code=400, detail="Catálogo no procesado. Ejecuta /pipeline/execute.")
        
    if "ID" not in hotels_df.columns:
        raise HTTPException(status_code=500, detail="Memory error: Columna ID ausente en hotels_clean.")
        
    matcher = HotelMatcher()
    processed_hotels = []
    hotels_coords = []
    hotel_names = []
    
    for h_id in req.hotel_ids:
        hotel_id_padded = str(h_id).strip().zfill(3)
        match = hotels_df[hotels_df["ID"] == hotel_id_padded]
        if match.empty:
            raise HTTPException(status_code=404, detail=f"Hotel {hotel_id_padded} no listado.")
            
        hotel_serie = match.iloc[0]
        try:
            coords = matcher.project_hotel_to_embedding_space(hotel_serie)
        except Exception as e:
            logger.error(f"Error projetando hotel {hotel_id_padded}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
            
        h_name = str(hotel_serie.get("HOTEL_NAME", "Unknown"))
        hotel_names.append(h_name)
        hotels_coords.append(coords)
        
        processed_hotels.append({
            "id": hotel_id_padded,
            "name": h_name,
            "coords_3d": [float(x) for x in coords]
        })
        
    # Obtener Clusters Afines
    if len(hotels_coords) == 1:
        affine = matcher.get_affine_clusters_for_hotel(hotels_coords[0], top_n=3)
    else:
        affine = matcher.get_intersection_clusters(hotels_coords, top_n=3)
        
    # Generar Contexto para el LLM
    combined_hotel_context = " + ".join(hotel_names)
    
    results_list = []
    cards = getattr(app_req.app.state, "cluster_cards", [])
    
    for a in affine:
        c_id = int(a[0])
        dist = float(a[1])
        
        c_card = next((c for c in cards if c["cluster_id"] == c_id), {})
        size = c_card.get("size", 0)
        
        try:
            ex_data = explain_cluster(c_id, ExplainRequest(hotel_name=combined_hotel_context), app_req)
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
        
    interpretation = f"Clientes afines a {combined_hotel_context}" if len(hotel_names) == 1 else f"Clientes afines a {' y '.join(hotel_names)}"
        
    return {
        "hotels": processed_hotels,
        "affine_clusters": results_list,
        "interpretation": interpretation
    }

from src.data.loader import load_hotel_data

@router.get("/hotels")
def get_all_hotels():
    """
    Devuelve TODOS los hoteles del hotel_data.csv sin filtros ni límites.
    """
    hotel_df = load_hotel_data()
    
    hotels = []
    for _, row in hotel_df.iterrows():
        hotels.append({
            "id": str(row.get("ID", "")).strip().zfill(3),
            "name": row.get("HOTEL_NAME", ""),
            "city": row.get("CITY_NAME", ""),
            "country": row.get("COUNTRY_ID", ""),
            "stars": int(row.get("STARS", 0)),
            "brand": row.get("BRAND", ""),
            "beach": float(row.get("CITY_BEACH_FLAG", 0)),
            "mountain": float(row.get("CITY_MOUNTAIN_FLAG", 0)),
            "heritage": float(row.get("CITY_HISTORICAL_HERITAGE", 0)),
            "gastronomy": float(row.get("CITY_GASTRONOMY", 0)),
            "price_level": float(row.get("CITY_PRICE_LEVEL", 0)),
        })
    
    return {"hotels": hotels, "total": len(hotels)}
