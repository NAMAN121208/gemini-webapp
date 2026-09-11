import os
import uuid
import asyncio
import re
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from google import genai
from google.genai import types
import requests

from schemas import HazardResponse

# ─── App Setup ────────────────────────────────────────────────────────────────
app = FastAPI(title="CivicShield API", version="1.0.0")

# ─── Security Headers Middleware ───────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), camera=(self), microphone=(self)"
    return response

# ─── Rate Limiting (simple in-memory) ─────────────────────────────────────────
from collections import defaultdict
import time
request_counts: dict = defaultdict(list)
RATE_LIMIT = 10  # max requests per minute per IP

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path == "/api/report":
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        # Keep only requests in the last 60s
        request_counts[client_ip] = [t for t in request_counts[client_ip] if now - t < 60]
        if len(request_counts[client_ip]) >= RATE_LIMIT:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please wait a minute before trying again."}
            )
        request_counts[client_ip].append(now)
    return await call_next(request)

# ─── CORS ─────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ─── Static Uploads ───────────────────────────────────────────────────────────
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

client = genai.Client()

# ─── Input Validation Helpers ─────────────────────────────────────────────────
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif", "heic"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_DESCRIPTION_LEN = 1000
SAFE_LANGUAGES = {
    "English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi",
    "Bengali", "Gujarati", "Punjabi", "Malayalam", "Odia"
}

def sanitize_text(text: str, max_len: int = 500) -> str:
    """Strip control chars and truncate to prevent prompt injection."""
    if not text:
        return ""
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    return text[:max_len]

def reverse_geocode(lat: float, lng: float) -> str:
    maps_api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    default_address = "Bangalore, Karnataka, India (Ward: Unknown, Pincode: 560001 - Default Fallback)"

    # Validate coordinate ranges
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return default_address

    if not maps_api_key:
        return default_address

    try:
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={maps_api_key}"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "OK" and data.get("results"):
            return data["results"][0]["formatted_address"]
    except Exception as e:
        print(f"Geocoding error: {e}")

    return default_address

# ─── Main Report Endpoint ─────────────────────────────────────────────────────
@app.post("/api/report", response_model=HazardResponse)
async def report_hazard(
    request: Request,
    image: UploadFile = File(..., description="Photo of the civic hazard"),
    latitude: float = Form(..., ge=-90, le=90),
    longitude: float = Form(..., ge=-180, le=180),
    description: str = Form(None),
    language: str = Form("English"),
    user_name: str = Form(None),
    user_email: str = Form(None),
    user_phone: str = Form(None),
    user_address: str = Form(None)
):
    # ── Validate image type ──
    if not image.content_type or image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}")

    # ── Validate file extension ──
    file_ext = (image.filename.split(".")[-1].lower()) if image.filename and "." in image.filename else "jpg"
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file extension.")

    # ── Read and size-check ──
    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image too large. Maximum size is 10 MB.")
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image file provided.")

    # ── Sanitize text inputs ──
    description = sanitize_text(description or "", MAX_DESCRIPTION_LEN)
    language = language if language in SAFE_LANGUAGES else "English"
    user_name = sanitize_text(user_name or "", 100)
    user_email = sanitize_text(user_email or "", 200)
    user_phone = sanitize_text(user_phone or "", 20)
    user_address = sanitize_text(user_address or "", 300)

    # ── Save image ──
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    if os.environ.get("VERCEL") == "1":
        image_url = "[Evidence image captured locally by the reporting user]"
    else:
        upload_path = os.path.join(uploads_dir, unique_filename)
        with open(upload_path, "wb") as f:
            f.write(image_bytes)
        image_url = f"{request.base_url}uploads/{unique_filename}"

    address = reverse_geocode(latitude, longitude)

    # ── Build prompt ──
    prompt = f"""
    Analyze the provided image of a civic hazard located at approximately this address: {address}.
    """

    if description:
        prompt += f"\nUser provided additional context: '{description}'\n"

    user_info = []
    if user_name:    user_info.append(f"Name: {user_name}")
    if user_email:   user_info.append(f"Email: {user_email}")
    if user_phone:   user_info.append(f"Phone: {user_phone}")
    if user_address: user_info.append(f"Address: {user_address}")

    if user_info:
        prompt += "\nThe following complainant details MUST appear in the formal_petition signature:\n"
        prompt += "\n".join(user_info) + "\n"

    prompt += f"""
    Identify the safety risks, determine the responsible_authority, cite relevant citizen_legal_rights
    (e.g., Article 21 of the Indian Constitution, local municipal acts), draft a formal_petition,
    and formulate targeted rti_questions regarding its maintenance.

    CRITICAL INSTRUCTION FOR LANGUAGE:
    The `formal_petition` and `rti_questions` MUST be written fluently in {language}.
    All other JSON fields may remain in English.

    CRITICAL INSTRUCTION FOR DANGER SCORE:
    Assign `danger_score` (1-10) based strictly on visual severity. Do NOT default to 8.
    - 1–3: Minor nuisance (litter, fading paint, slight crack)
    - 4–6: Moderate issue (small pothole, broken bench, overflowing bin)
    - 7–8: Serious hazard (deep pothole, leaning tree, minor exposed wiring)
    - 9–10: Life-threatening emergency (sinkhole, collapsed structure, live sparking wire, missing manhole)
    """

    # ── Call Gemini with retry ──
    max_retries = 3
    for attempt in range(max_retries):
        try:
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
            result.image_url = image_url
            return result

        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"AI response validation error: {e}")
        except Exception as e:
            error_str = str(e)
            if "503" in error_str or "UNAVAILABLE" in error_str:
                if attempt < max_retries - 1:
                    print(f"Gemini 503 on attempt {attempt+1}, retrying in {2**attempt}s...")
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise HTTPException(status_code=503, detail="AI model is under high demand. Please try again shortly.")
            if "404" in error_str and attempt < max_retries - 1:
                continue
            raise HTTPException(status_code=500, detail=f"AI API error: {error_str}")

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

# ─── Serve Frontend Build ─────────────────────────────────────────────────────
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
