import os
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# Note: In a real application, you would initialize the Gemini client here.
# For example:
# import google.generativeai as genai
# genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

@app.route('/', methods=['GET'])
def index():
    return "<h1>Gemini Web App is Running!</h1><p>Ready to process requests.</p>"

@app.route('/api/generate', methods=['POST'])
def generate():
    data = request.json
    prompt = data.get('prompt', '')
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    # Placeholder for Gemini API call
    # model = genai.GenerativeModel('gemini-1.5-pro')
    # response = model.generate_content(prompt)
    # return jsonify({"response": response.text})
    
    return jsonify({"response": f"Mock response for prompt: {prompt}"})

if __name__ == '__main__':
    # Use the PORT environment variable if available (required by Cloud Run)
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
