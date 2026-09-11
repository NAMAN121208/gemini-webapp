import pytest
from fastapi.testclient import TestClient
import json
import sys
import os
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_report_endpoint_no_image():
    response = client.post("/api/report", data={"latitude": 12.9716, "longitude": 77.5946})
    assert response.status_code == 422 

@patch("main.reverse_geocode")
@patch("main.client.models.generate_content")
def test_report_endpoint_success(mock_generate_content, mock_reverse_geocode):
    mock_reverse_geocode.return_value = "Mocked Address, Bangalore (Ward 10, 560001)"
    
    mock_response_json = json.dumps({
        "hazard_summary": "Large pothole on main road",
        "danger_score": 8,
        "responsible_authority": "BBMP",
        "citizen_legal_rights": ["Right to Life (Article 21)"],
        "formal_petition": {
            "subject": "Urgent complaint regarding life-threatening pothole",
            "body": "Dear Sir/Madam, please repair the pothole immediately."
        },
        "rti_questions": [
            {"question": "When was the last maintenance contract issued?"}
        ]
    })
    
    class MockResponse:
        text = mock_response_json
        
    mock_generate_content.return_value = MockResponse()
    
    dummy_image = b"dummy bytes"
    files = {"image": ("test.jpg", dummy_image, "image/jpeg")}
    data = {"latitude": 12.9716, "longitude": 77.5946}
    
    response = client.post("/api/report", files=files, data=data)
    assert response.status_code == 200
    
    result = response.json()
    assert result["danger_score"] == 8
    assert result["responsible_authority"] == "BBMP"
