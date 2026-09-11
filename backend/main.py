import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from google import genai
from google.genai import types
import requests

from schemas import HazardResponse

# Set up app
app = FastAPI(title="CivicShield API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client()

def reverse_geocode(lat: float, lng: float) -> str:
    maps_api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    default_address = "Bangalore, Karnataka, India (Ward: Unknown, Pincode: 560001 - Default Fallback)"
    
    if not maps_api_key:
        return default_address
        
    try:
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={maps_api_key}"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "OK" and len(data.get("results", [])) > 0:
            # Try to extract sublocality/ward and postal_code specifically if needed, 
            # otherwise return the formatted address which contains them.
            address = data["results"][0]["formatted_address"]
            return address
    except Exception as e:
        print(f"Geocoding error: {e}")
        
    return default_address

@app.post("/api/report", response_model=HazardResponse)
async def report_hazard(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    description: str = Form(None),
    language: str = Form("English"),
    user_name: str = Form(None),
    user_email: str = Form(None),
    user_phone: str = Form(None),
    user_address: str = Form(None)
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    image_bytes = await image.read()
    address = reverse_geocode(latitude, longitude)
    
    prompt = f"""
    Analyze the provided image of a civic hazard located at approximately this address (include municipal ward/pincode context if available): {address}.
    """
    
    if description:
        prompt += f"\nUser provided additional context: '{description}'\n"
        
    user_info = []
    if user_name: user_info.append(f"Name: {user_name}")
    if user_email: user_info.append(f"Email: {user_email}")
    if user_phone: user_info.append(f"Phone: {user_phone}")
    if user_address: user_info.append(f"Address: {user_address}")
    
    if user_info:
        prompt += "\nThe following details of the complainant MUST be included as the signature/sender in the drafted formal_petition:\n"
        prompt += "\n".join(user_info) + "\n"
        
    prompt += f"""
    Identify the safety risks, determine the responsible_authority, cite relevant citizen_legal_rights (e.g., Article 21 of the Indian Constitution, local municipal acts), draft a formal_petition, and formulate targeted rti_questions regarding its maintenance.
    
    CRITICAL INSTRUCTION FOR LANGUAGE:
    The `formal_petition` and `rti_questions` MUST be written fluently in {language}. The rest of the JSON fields (like hazard_summary, responsible_authority) can remain in English, but the actual drafted documents MUST be in {language}.
    
    CRITICAL INSTRUCTION FOR DANGER SCORE:
    When assigning the `danger_score` (1-10), you MUST use the full range of the scale based on objective visual severity. Do NOT default to 8.
    Use this strict rubric:
    - 1 to 3: Minor nuisance (e.g., mild litter, fading road paint, slight pavement crack).
    - 4 to 6: Moderate issue requiring maintenance but not immediately life-threatening (e.g., small pothole, broken bench, overflowing bin).
    - 7 to 8: Serious hazard posing significant risk of injury or vehicle damage (e.g., large deep pothole in traffic, leaning tree, minor exposed wiring).
    - 9 to 10: Critical life-threatening emergency (e.g., massive sinkhole, collapsed infrastructure, live sparking high-voltage transformer, completely missing manhole cover on a dark street).
    """
    
    import asyncio
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # First try the primary flash model
            model_name = 'gemini-3.5-flash' if attempt < 2 else 'gemini-1.5-pro'
            
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=image.content_type),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=HazardResponse,
                    temperature=0.2,
                ),
            )
            result = HazardResponse.model_validate_json(response.text)
            return result
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"Data validation error from AI response: {e}")
        except Exception as e:
            error_str = str(e)
            if "503" in error_str or "UNAVAILABLE" in error_str:
                if attempt < max_retries - 1:
                    print(f"Gemini 503 error on attempt {attempt+1}, retrying...")
                    await asyncio.sleep(2 ** attempt)  # 1s, 2s
                    continue
                else:
                    raise HTTPException(status_code=503, detail="The AI model is currently experiencing high demand. Please try again in a few minutes.")
            
            # If it's a 404 (model not found), try falling back immediately on next loop
            if "404" in error_str and attempt < max_retries - 1:
                continue
                
            raise HTTPException(status_code=500, detail=f"Failed to process with Gemini API: {error_str}")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# Serve static files for frontend build
from fastapi.staticfiles import StaticFiles
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
