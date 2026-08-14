import time
print("Importing cv2...")
t0 = time.time()
import cv2
print(f"Imported cv2 in {time.time()-t0:.2f}s")

print("Importing torch...")
t0 = time.time()
import torch
print(f"Imported torch in {time.time()-t0:.2f}s")
print("CUDA Available:", torch.cuda.is_available())

print("Importing ultralytics...")
t0 = time.time()
from ultralytics import YOLO
print(f"Imported ultralytics in {time.time()-t0:.2f}s")
