"""Carga y validación de los datos CSV."""
import pandas as pd
from pathlib import Path
import os
import logging

logger = logging.getLogger(__name__)

class DataLoader:
    def __init__(self, data_dir: str = "data/raw"):
        self.data_dir = Path(data_dir)
        self.customer_file = self.data_dir / "customer_data_200.csv"
        self.hotel_file = self.data_dir / "hotel_data.csv"

    def load_customers(self) -> pd.DataFrame:
        """Carga el dataset de clientes desde el CSV."""
        if not self.customer_file.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {self.customer_file}")
            
        logger.info(f"Cargando dataset de clientes desde {self.customer_file}")
        # Leer usando separador ';' 
        df = pd.read_csv(self.customer_file, sep=";")
        
        # Validar algunas columnas esperadas
        expected_cols = ["GUEST_ID", "RESERVATION_ID", "HOTEL_ID", "AGE_RANGE", "COUNTRY_GUEST", "GENDER_ID"]
        missing_cols = [c for c in expected_cols if c not in df.columns]
        if missing_cols:
            logger.warning(f"Faltan columnas esperadas en clientes: {missing_cols}")
            
        # Forzar tipos de IDs a string por seguridad
        df['GUEST_ID'] = df['GUEST_ID'].astype(str)
        if 'HOTEL_ID' in df.columns:
            # Los ids de hotel en hotel_data son str y pueden tener ceros a la izquierda (ej. "041")
            df['HOTEL_ID'] = df['HOTEL_ID'].astype(str).str.zfill(3)
            
        return df

    def load_hotels(self) -> pd.DataFrame:
        """Carga el dataset de hoteles desde el CSV."""
        if not self.hotel_file.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {self.hotel_file}")
            
        logger.info(f"Cargando dataset de hoteles desde {self.hotel_file}")
        df = pd.read_csv(self.hotel_file, sep=";")
        
        expected_cols = ["ID", "STARS", "CITY_BEACH_FLAG"]
        missing_cols = [c for c in expected_cols if c not in df.columns]
        if missing_cols:
            logger.warning(f"Faltan columnas esperadas en hoteles: {missing_cols}")
            
        # Forzar tipo de ID de hotel para merge seguro
        df['ID'] = df['ID'].astype(str).str.zfill(3)
        return df

    def get_data(self):
        """Carga ambos datasets."""
        customers = self.load_customers()
        hotels = self.load_hotels()
        return customers, hotels
