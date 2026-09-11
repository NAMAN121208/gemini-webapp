import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import io
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from backend.main import app

client = TestClient(app)


class TestHealthEndpoint:
    def test_health_check_returns_ok(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data

    def test_health_check_is_fast(self):
        import time
        start = time.time()
        client.get("/api/health")
        elapsed = time.time() - start
        assert elapsed < 1.0  # Should respond in under 1 second


class TestInputValidation:
    def test_rejects_non_image_file(self):
        fake_pdf = io.BytesIO(b"%PDF-1.4 fake pdf content")
        response = client.post(
            "/api/report",
            files={"image": ("test.pdf", fake_pdf, "application/pdf")},
            data={"latitude": "12.9716", "longitude": "77.5946"}
        )
        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    def test_rejects_empty_image(self):
        response = client.post(
            "/api/report",
            files={"image": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
            data={"latitude": "12.9716", "longitude": "77.5946"}
        )
        assert response.status_code == 400

    def test_rejects_invalid_latitude(self):
        fake_img = io.BytesIO(b"\xff\xd8\xff" + b"x" * 100)
        response = client.post(
            "/api/report",
            files={"image": ("test.jpg", fake_img, "image/jpeg")},
            data={"latitude": "999", "longitude": "77.5946"}
        )
        assert response.status_code == 422

    def test_rejects_invalid_longitude(self):
        fake_img = io.BytesIO(b"\xff\xd8\xff" + b"x" * 100)
        response = client.post(
            "/api/report",
            files={"image": ("test.jpg", fake_img, "image/jpeg")},
            data={"latitude": "12.9716", "longitude": "999"}
        )
        assert response.status_code == 422

    def test_missing_image_returns_422(self):
        response = client.post(
            "/api/report",
            data={"latitude": "12.9716", "longitude": "77.5946"}
        )
        assert response.status_code == 422

    def test_missing_coordinates_returns_422(self):
        fake_img = io.BytesIO(b"\xff\xd8\xff" + b"x" * 100)
        response = client.post(
            "/api/report",
            files={"image": ("test.jpg", fake_img, "image/jpeg")},
        )
        assert response.status_code == 422


class TestSanitization:
    def test_sanitize_text_strips_control_chars(self):
        from backend.main import sanitize_text
        result = sanitize_text("Hello\x00World\x07Test")
        assert "\x00" not in result
        assert "\x07" not in result
        assert "HelloWorldTest" == result

    def test_sanitize_text_truncates(self):
        from backend.main import sanitize_text
        long_text = "A" * 2000
        result = sanitize_text(long_text, max_len=100)
        assert len(result) == 100

    def test_sanitize_empty_string(self):
        from backend.main import sanitize_text
        assert sanitize_text("") == ""
        assert sanitize_text(None) == ""


class TestReverseGeocode:
    def test_returns_default_without_api_key(self):
        from backend.main import reverse_geocode
        result = reverse_geocode(12.9716, 77.5946)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_rejects_invalid_coordinates(self):
        from backend.main import reverse_geocode
        result = reverse_geocode(999, 999)
        assert "Default Fallback" in result

    @patch("backend.main.requests.get")
    def test_uses_api_response_when_key_present(self, mock_get):
        from backend.main import reverse_geocode
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "status": "OK",
            "results": [{"formatted_address": "MG Road, Bengaluru, Karnataka 560001, India"}]
        }
        mock_get.return_value = mock_response

        with patch.dict(os.environ, {"GOOGLE_MAPS_API_KEY": "fake_key"}):
            result = reverse_geocode(12.9716, 77.5946)
        assert "MG Road" in result


class TestSecurityHeaders:
    def test_security_headers_present_on_health(self):
        response = client.get("/api/health")
        assert "x-content-type-options" in response.headers
        assert response.headers["x-content-type-options"] == "nosniff"
        assert "x-frame-options" in response.headers
        assert response.headers["x-frame-options"] == "DENY"
