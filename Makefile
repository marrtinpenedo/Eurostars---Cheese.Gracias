.PHONY: run test install

install:
	pip install -r requirements.txt

run:
	uvicorn src.api.main:app --reload

test:
	pytest tests/
