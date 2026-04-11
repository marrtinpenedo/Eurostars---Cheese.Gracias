import os
import sys
from dotenv import load_dotenv
load_dotenv(".env")
from google import genai
from google.genai import types

api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

try:
    response = client.models.generate_content(
        model=os.environ.get("VERTEX_MODEL", "gemini-2.5-flash"),
        contents="Hola, genera 5 frases largas sobre queso.",
    )
    print("TEXT:", response.text)
    print("FINISH_REASON:", response.candidates[0].finish_reason if response.candidates else "No candidates")
except Exception as e:
    print("ERROR:", e)
