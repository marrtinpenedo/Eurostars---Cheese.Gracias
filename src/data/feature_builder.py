"""Construcción del vector de historia por cliente (CLAVE).

Aquí se define el vector de identidad calculando agregaciones 
históricas: estancias previas, ADR, duración media, etc.
"""
import pandas as pd
import logging

logger = logging.getLogger(__name__)

class FeatureBuilder:
    def __init__(self):
        pass
        
    def build_features(self, customers_df: pd.DataFrame, hotels_df: pd.DataFrame) -> pd.DataFrame:
        """
        Cruza clientes y hoteles y colapsa la historia por GUEST_ID.
        Devuelve el vector 'STAYPRINT' puramente numérico por cliente.
        """
        logger.info("Construyendo vector histórico (STAYPRINT) por cliente...")
        
        # 1. Cruzar datos (Left join)
        merged_df = pd.merge(customers_df, hotels_df, left_on="HOTEL_ID", right_on="ID", how="left")
        
        # 2. Definir las agregaciones por cliente
        agg_dict = {
            "AGE_NUM": "first",
            "COUNTRY_GUEST": "first",
            "GENDER_ID": "first",
            
            "CONFIRMED_RESERVATIONS": "max",
            "LAST_2_YEARS_STAYS": "max",
            "CONFIRMED_RESERVATIONS_ADR": "mean",
            "AVG_LENGTH_STAY": "mean",
            "AVG_BOOKING_LEADTIME": "mean",
            "AVG_SCORE": "mean",
            
            "STARS": "mean",
            "CITY_BEACH_FLAG": "mean",
            "CITY_MOUNTAIN_FLAG": "mean",
            "CITY_HISTORICAL_HERITAGE": "mean",
            "CITY_PRICE_LEVEL": "mean",
            "CITY_GASTRONOMY": "mean"
        }
        
        # Asegurar columnas existentes
        agg_dict_safe = {k: v for k, v in agg_dict.items() if k in merged_df.columns}
        
        # Agrupar por GUEST_ID
        history_vector = merged_df.groupby("GUEST_ID").agg(agg_dict_safe)
        
        # Preferencia de clima u otras moda (mes)
        def mode_func(x):
            m = x.dropna().mode()
            return m.iloc[0] if not m.empty else "UNKNOWN"
            
        if "CITY_CLIMATE" in merged_df.columns:
            history_vector["FAV_CLIMATE"] = merged_df.groupby("GUEST_ID")["CITY_CLIMATE"].agg(mode_func)
            
        if "CHECKIN_MONTH" in merged_df.columns:
            # Reusamos wrapper numérico x si mode_func da str
            history_vector["PEAK_MONTH"] = merged_df.groupby("GUEST_ID")["CHECKIN_MONTH"].agg(lambda x: x.mode()[0] if not x.mode().empty else 6)
            
        # 3. One-Hot encoding de categóricas para el vector final
        categorical_cols = [c for c in ["COUNTRY_GUEST", "GENDER_ID", "FAV_CLIMATE"] if c in history_vector.columns]
        history_vector_encoded = pd.get_dummies(history_vector, columns=categorical_cols, dummy_na=False).astype(float)
        
        # Eliminar cualquier índice con NaN en caso extremo y llenar el resto
        history_vector_encoded = history_vector_encoded.fillna(0.0)
        
        logger.info(f"Vector creado: shape {history_vector_encoded.shape}")
        return history_vector_encoded
