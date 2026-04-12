# Directorio de Datos — NEXUS

## Estructura

```
data/
├── raw/                    # CSVs fuente originales (no modificar)
│   ├── customer_data_*.csv # Datos históricos de clientes
│   └── hotel_data.csv      # Catálogo de hoteles con atributos geográficos
└── processed/              # Artefactos intermedios (generados en runtime, no versionados)
```

## Formato de los CSV

### `customer_data_*.csv` (sep=`;`)

| Columna | Tipo | Descripción |
|---|---|---|
| `GUEST_ID` | str (zfill 3) | Identificador anónimo del cliente |
| `HOTEL_ID` | str (zfill 3) | Hotel donde se alojó |
| `CONFIRMED_RESERVATIONS_ADR` | float | Gasto medio por noche |
| `LAST_2_YEARS_STAYS` | int | Estancias en los últimos 2 años |
| `AGE_RANGE` | str | Rango de edad (mapeado a ordinal numérico) |
| `GENDER_ID` | str | Género del cliente |
| `COUNTRY_GUEST` | str | País de procedencia |
| `CHECKIN_DATE` | date | Fecha de entrada (se extrae `CHECKIN_MONTH`) |
| `BOOKING_LEADTIME` | int | Días de antelación de la reserva |

### `hotel_data.csv` (sep=`;`)

| Columna | Tipo | Descripción |
|---|---|---|
| `ID` | str (zfill 3) | Identificador del hotel |
| `NAME` | str | Nombre del hotel |
| `CITY` | str | Ciudad |
| `STARS` | int | Categoría de estrellas |
| `CITY_BEACH_FLAG` | int | 1 si es hotel de playa |
| `CITY_MOUNTAIN_FLAG` | int | 1 si es hotel de montaña |
| `GASTRONOMIC_FLAG` | int | 1 si destino gastronómico |
| `HERITAGE_FLAG` | int | 1 si destino patrimonio |

## Notas

- Los CSV se leen con `sep=";"` y codificación UTF-8.
- `GUEST_ID` y `HOTEL_ID` se normalizan con `zfill(3)` para garantizar joins correctos.
- Los archivos en `raw/` son inmutables. El pipeline los lee pero nunca los modifica.
- Los modelos entrenados se guardan en `models/` (raíz del proyecto), no en `data/`.
