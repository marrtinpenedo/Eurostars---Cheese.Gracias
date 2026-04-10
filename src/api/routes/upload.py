"""Endpoint para la subida de los archivos CSV."""
from fastapi import APIRouter, File, UploadFile
import shutil
import os

router = APIRouter()

@router.post("/")
async def upload_files(customer_file: UploadFile = File(...), hotel_file: UploadFile = File(...)):
    """
    Guarda los CSVs en data/raw/
    """
    os.makedirs("data/raw", exist_ok=True)
    
    # Sobrescribimos siempre con el mismo nombre para el pipeline
    customer_path = "data/raw/customer_data_200.csv"
    hotel_path = "data/raw/hotel_data.csv"
    
    with open(customer_path, "wb") as buffer:
        shutil.copyfileobj(customer_file.file, buffer)
        
    with open(hotel_path, "wb") as buffer:
        shutil.copyfileobj(hotel_file.file, buffer)
        
    return {"message": "Archivos subidos correctamente. Usa /pipeline para procesarlos."}
