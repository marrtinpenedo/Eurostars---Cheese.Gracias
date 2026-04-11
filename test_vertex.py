import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv('.env')

project = os.getenv("GOOGLE_CLOUD_PROJECT")
location = os.getenv("VERTEX_LOCATION")

print(f"Project: {project}, Location: {location}")

try:
    client = genai.Client(vertexai=True, project=project, location=location)
    response = client.models.generate_content(
        model=os.getenv("VERTEX_MODEL", "gemini-2.5-flash"),
        contents="Hola, responde 'funciona'",
    )
    print("Respuesta:", response.text)
except Exception as e:
    import traceback
    traceback.print_exc()
