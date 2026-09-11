# Gemini Web Application

This is a starter web application powered by the Gemini API, designed to be deployed on Google Cloud Run.

## Project Description

[Add a brief description of your project here. What does this application do? What specific Gemini features does it use (e.g., text generation, vision, multi-modal)?]

## Folder Structure

- `app.py`: The main web application code (Flask).
- `requirements.txt`: Python dependencies.
- `Dockerfile`: Instructions to build the Docker container for Cloud Run.
- `templates/`: HTML templates for the web application.
- `static/`: Static assets (CSS, JS, images).

## Local Development

1. Ensure you have Python installed.
2. Set your Google Gemini API key as an environment variable:
   - Windows: `set GEMINI_API_KEY=your_api_key`
   - Linux/Mac: `export GEMINI_API_KEY=your_api_key`
3. Install dependencies: `pip install -r requirements.txt`
4. Run the application: `python app.py`

## Deployment to Google Cloud Run

This project is configured for easy deployment to Google Cloud Run.

1. Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. Authenticate: `gcloud auth login`
3. Set your project: `gcloud config set project YOUR_PROJECT_ID`
4. Build and deploy:
   ```bash
   gcloud run deploy gemini-webapp --source . --region us-central1 --allow-unauthenticated --set-env-vars="GEMINI_API_KEY=your_api_key"
   ```
