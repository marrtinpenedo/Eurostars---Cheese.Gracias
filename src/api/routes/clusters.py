"""Endpoints de exposición de los hiper-segmentos de marketing."""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import PlainTextResponse

router = APIRouter()

@router.get("/summary")
def get_clusters_summary(request: Request):
    """
    Devuelve la tarjeta descriptiva de cada segmento en formato JSON.
    Ordenadas previamente por el Profiler.
    """
    cards = getattr(request.app.state, "cluster_cards", None)
    if cards is None:
        raise HTTPException(status_code=400, detail="Debes analizar (recluster) primero para extraer los segmentos útiles.")
    
    return {"clusters": cards}

@router.get("/{cluster_id}/export", response_class=PlainTextResponse)
def export_cluster_csv(cluster_id: int, request: Request):
    """
    Exporta un CSV limpio únicamente con la columna GUEST_ID de la vecindad seleccionada.
    Sin datos personales adicionales por seguridad.
    """
    labels = getattr(request.app.state, "labels", None)
    vec = getattr(request.app.state, "stayprint_vector", None)
    
    if labels is None or vec is None:
        raise HTTPException(status_code=400, detail="Pipeline no ejecutado.")
        
    mask = (labels == cluster_id)
    guest_ids = vec.index[mask].tolist()
    
    if not guest_ids:
        raise HTTPException(status_code=404, detail="El segmento especificado no existe o no tiene elementos.")
        
    # Construir el CSV en texto a partir del Index (el index es el GUEST_ID en stayprint_vector)
    csv_str = "GUEST_ID\n" + "\n".join(str(g) for g in guest_ids)
    
    return PlainTextResponse(content=csv_str, headers={
        "Content-Disposition": f"attachment; filename=segment_{cluster_id}_export.csv",
        "Content-Type": "text/csv"
    })
