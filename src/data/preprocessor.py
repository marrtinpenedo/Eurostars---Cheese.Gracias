"""Limpieza, normalización y discretización."""
import pandas as pd
import logging

logger = logging.getLogger(__name__)

class DataPreprocessor:
    def __init__(self):
        # Mapeos predefinidos para variables ordinales
        self.age_map = {
            "19-25": 1,
            "26-35": 2,
            "36-45": 3,
            "46-55": 4,
            "56-65": 5,
            ">65": 6
        }
        
        self.level_map = {
            "LOW": 1,
            "MEDIUM": 2,
            "HIGH": 3
        }

    def preprocess_customers(self, df: pd.DataFrame) -> pd.DataFrame:
        """Limpia y transforma el dataset de clientes."""
        logger.info("Preprocesando clientes...")
        df_clean = df.copy()
        
        # Mapear AGE_RANGE a ordinal numérico
        if "AGE_RANGE" in df_clean.columns:
            df_clean["AGE_NUM"] = df_clean["AGE_RANGE"].map(self.age_map).fillna(3) # usar 3 como fallback
            
        # Limpiar numéricos (en caso de que vengan como strings con comas, o nulos)
        cols_to_fill = ["CONFIRMED_RESERVATIONS_ADR", "AVG_LENGTH_STAY", "AVG_BOOKING_LEADTIME", "AVG_SCORE", "LAST_2_YEARS_STAYS", "CONFIRMED_RESERVATIONS"]
        for col in cols_to_fill:
            if col in df_clean.columns:
                df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce').fillna(0.0)
                
        return df_clean

    def preprocess_hotels(self, df: pd.DataFrame) -> pd.DataFrame:
        """Limpia y transforma el dataset de hoteles."""
        logger.info("Preprocesando hoteles...")
        df_clean = df.copy()
        
        # Flags booleanos a 1/0
        bool_cols = ["CITY_BEACH_FLAG", "CITY_MOUNTAIN_FLAG"]
        for col in bool_cols:
            if col in df_clean.columns:
                df_clean[col] = df_clean[col].apply(lambda x: 1 if str(x).strip().upper() == "YES" else 0)
                
        # Niveles ordinales a 1/2/3
        level_cols = ["CITY_HISTORICAL_HERITAGE", "CITY_PRICE_LEVEL", "CITY_GASTRONOMY"]
        for col in level_cols:
            if col in df_clean.columns:
                df_clean[col] = df_clean[col].astype(str).str.strip().str.upper().map(self.level_map).fillna(2) # Fallback a MEDIUM
                
        # Stars a numérico
        if "STARS" in df_clean.columns:
            df_clean["STARS"] = pd.to_numeric(df_clean["STARS"], errors='coerce').fillna(3.0)

        # Tratar CLIMATE como string limpia
        if "CITY_CLIMATE" in df_clean.columns:
            df_clean["CITY_CLIMATE"] = df_clean["CITY_CLIMATE"].astype(str).str.strip().str.upper()
            
        return df_clean
