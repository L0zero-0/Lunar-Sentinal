# Lunar-Sentinal

Lunar-Sentinal is a lunar crater detection dashboard with a FastAPI backend and a Vite React frontend.

The backend loads the trained YOLO model from:

```text
backend/weights/best.pt
```

The frontend connects to the backend at:

```text
http://127.0.0.1:8001
```

## Project Structure

```text
Lunar-Sentinal/
  backend/
    main.py
    detector.py
    camera_handler.py
    streamer.py
    requirements.txt
    weights/
      best.pt
  frontend/
    src/
    public/
    package.json
    package-lock.json
    vite.config.js
  README.md
  .gitignore
```

## Requirements

Install these before running the project:

- Python 3.10 or newer
- Node.js 18 or newer
- Git
- A webcam, phone camera, or image file for testing detection

## 1. Clone The Repository

```bash
git clone https://github.com/L0zero-0/Lunar-Sentinal.git
cd Lunar-Sentinal
```

## 2. Check The Trained Model

Make sure this file exists:

```text
backend/weights/best.pt
```

This is the trained model used by the backend. Other model/checkpoint files are ignored by Git.

## 3. Set Up The Backend

Open a terminal in the project root, then run:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Start the backend:

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

The backend should now be running at:

```text
http://127.0.0.1:8001
```

You can test it in a browser:

```text
http://127.0.0.1:8001/health
```

## 4. Set Up The Frontend

Open a second terminal in the project root, then run:

```bash
cd frontend
npm install
npm run dev
```

Vite will show a local URL, usually:

```text
http://localhost:5173
```

Open that URL in your browser.

## 5. Running The Full App

You need two terminals running at the same time:

Terminal 1, backend:

```bash
cd backend
venv\Scripts\activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Terminal 2, frontend:

```bash
cd frontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

## Useful Backend URLs

```text
http://127.0.0.1:8001/
http://127.0.0.1:8001/health
http://127.0.0.1:8001/cameras
http://127.0.0.1:8001/video-feed
http://127.0.0.1:8001/stats
```

## Common Problems

If the frontend says the backend is not running, make sure the backend is running on port `8001`.

If Python dependencies fail to install, upgrade pip first:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If the camera does not open, try closing other apps using the camera, then restart the backend.

If the model does not load, confirm that this file exists:

```text
backend/weights/best.pt
```

If `npm run dev` fails, reinstall frontend dependencies:

```bash
cd frontend
npm install
npm run dev
```

## Git Notes

The repository intentionally ignores generated files and local environments:

```text
backend/venv/
frontend/node_modules/
frontend/dist/
__pycache__/
*.log
```

The trained model is kept:

```text
backend/weights/best.pt
```

Other model files, such as `last.pt`, are ignored.
