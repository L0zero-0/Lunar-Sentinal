@echo off
".\venv\Scripts\python.exe" -u -m uvicorn main:app --port 8001 > uvicorn_stdout.log 2>&1
