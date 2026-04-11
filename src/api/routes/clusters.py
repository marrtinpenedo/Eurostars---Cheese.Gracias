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

from pydantic import BaseModel
from typing import Optional
from src.clustering.explainer import get_full_explanation

class ExplainRequest(BaseModel):
    hotel_name: Optional[str] = None

from src.clustering.explainer import get_openai_client

@router.get("/debug/openai")
async def debug_openai():
    try:
        client = get_openai_client()
        # Llamada mínima para verificar autenticación
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "di ok"}],
            max_tokens=5
        )
        return {"status": "ok", "model": "llama-3.3-70b-versatile", "response": response.choices[0].message.content}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@router.post("/{cluster_id}/explain")
def explain_cluster(cluster_id: int, req: ExplainRequest, request: Request):
    """
    Despliega la explicación de marketing de un cluster usando la caché para no saturar OpenAI.
    """
    cards = getattr(request.app.state, "cluster_cards", None)
    global_stats = getattr(request.app.state, "global_stats", None)
    
    if not cards or not global_stats:
        raise HTTPException(status_code=400, detail="Debes analizar (recluster) primero para extraer los segmentos.")
        
    # Inicializar caché en el estado si no existe
    if not hasattr(request.app.state, "explanations_cache"):
        request.app.state.explanations_cache = {}
        
    cache_key = (cluster_id, req.hotel_name)
    if cache_key in request.app.state.explanations_cache:
        return request.app.state.explanations_cache[cache_key]
        
    # Generar
    explanation = get_full_explanation(
        cluster_id=cluster_id,
        cluster_profiles=cards,
        global_stats=global_stats,
        hotel_name=req.hotel_name
    )
    
    # Guardar en caché
    request.app.state.explanations_cache[cache_key] = explanation
    
    return explanation
