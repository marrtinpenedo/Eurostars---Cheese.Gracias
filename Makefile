.PHONY: run test install demo

install:
	pip install -r requirements.txt

run:
	uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

test:
	pytest tests/

demo:
	@echo "========================================================="
	@echo " 🚀 STAYPRINT: Modo Demo Inicializado"
	@echo " Los datos de demostración están listos."
	@echo " Visita: http://localhost:8000 en tu navegador"
	@echo " y haz click en 'Procesar Nube Geodésica'."
	@echo "========================================================="
	uvicorn src.api.main:app --host 0.0.0.0 --port 8000
