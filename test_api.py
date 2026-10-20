import requests
import json
import base64
import os

# Configuration
BASE_URL = "http://localhost:3000"

# Try to find the API token
API_TOKEN = None

# 1. Try TOKEN.txt
token_path = os.path.join("ts-automation", "TOKEN.txt")
if os.path.exists(token_path):
    with open(token_path, "r") as f:
        API_TOKEN = f.read().strip()

# 2. Try .env
if not API_TOKEN:
    env_path = os.path.join("ts-automation", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith("PC_API_TOKEN="):
                    API_TOKEN = line.split("=", 1)[1].strip().strip('"')
                    break

if not API_TOKEN:
    # Fallback
    API_TOKEN = "oservices_ertyugvftyuifr56787ert7erty7654ertyhjuffrcvbnmmnxssaqasaaw34567"

headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

print(f"Using Token: {API_TOKEN}")
print(f"Using Headers: {headers}")

def test_voices():
    print("\n--- Testing GET /api/voices ---")
    try:
        response = requests.get(f"{BASE_URL}/api/voices", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Voices found: {len(data.get('voices', []))}")
            if data['voices']:
                print(f"First voice: {data['voices'][0]}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def test_generate_voice():
    print("\n--- Testing POST /api/generate-voice ---")
    payload = {
        "text": "Hello, this is a test of the NanoFlow voice system.",
        "voice": "en-US-AriaNeural"
    }
    try:
        response = requests.post(f"{BASE_URL}/api/generate-voice", headers=headers, json=payload)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('audioBase64'):
                print("Success! Received audio data.")
                # Save a sample to verify
                with open("test_voice_output.mp3", "wb") as f:
                    f.write(base64.b64decode(data['audioBase64']))
                print("Saved output to test_voice_output.mp3")
            else:
                print(f"Failed: {data}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def test_generate_image():
    print("\n--- Testing POST /api/generate (IMAGE) ---")
    payload = {
        "type": "IMAGE",
        "prompt": "A beautiful sunset over a old ancinet buried city",
        "aspectRatio": "16_9",
        "resultCount": 1,
        "modelName": "Imagen 4",
        "waitForCompletion": True,
        "userId": "test-user-id"
    }
    try:
        # Increase timeout to 5 minutes for generation
        response = requests.post(f"{BASE_URL}/api/generate", json=payload, headers=headers, timeout=300)
        print(f"Status: {response.status_code}")
        
        result = response.json()
        if result.get("success"):
            task = result.get("task", {})
            print(f"✅ Success! Task ID: {task.get('id')}")
            if task.get("resultUrl"):
                print(f"🔗 Google URL: {task.get('resultUrl')}")
            if task.get("videoBase64"):
                print(f"📦 Received Base64 Data (Length: {len(task.get('videoBase64'))})")
                # Optional: save to file
                with open("test_image_output.png", "wb") as f:
                    f.write(base64.b64decode(task['videoBase64']))
                print("💾 Saved output to test_image_output.png")
            else:
                print("⚠️ No Base64 data received.")
        else:
            print(f"❌ Failed: {result.get('error')}")
            
    except requests.exceptions.Timeout:
        print("Timeout: The request took too long.")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    # test_voices()
    # test_generate_voice()
    test_generate_image()
    
    # Notify user on completion
