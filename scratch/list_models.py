import os
from dotenv import load_dotenv
load_dotenv(".env")
from google import genai

api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

try:
    models = client.models.list()
    for m in models:
        if "flash" in m.name:
            print(m.name)
except Exception as e:
    print("ERROR:", e)
