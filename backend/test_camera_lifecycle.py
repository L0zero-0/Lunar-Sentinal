import cv2
import time
import sys

def test_camera(index=0):
    print(f"=== TESTING CAMERA INDEX {index} ===")
    
    # Test 1
    print("\n[Test 1] Opening camera for the first time...")
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("Failed to open with CAP_DSHOW. Trying default backend...")
        cap = cv2.VideoCapture(index)
        
    if not cap.isOpened():
        print("ERROR: Could not open camera at all.")
        return False
        
    print("Camera opened successfully. Reading 5 frames...")
    for i in range(5):
        ret, frame = cap.read()
        if ret and frame is not None:
            print(f"  Frame {i+1} read successfully (shape: {frame.shape})")
        else:
            print(f"  Frame {i+1} FAILED to read")
        time.sleep(0.1)
        
    print("Releasing camera...")
    cap.release()
    print("Camera released.")
    
    # Wait
    sleep_time = 2.0
    print(f"\nWaiting {sleep_time} seconds for driver to recycle...")
    time.sleep(sleep_time)
    
    # Test 2
    print("[Test 2] Re-opening camera for the second time...")
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("Failed to open with CAP_DSHOW. Trying default backend...")
        cap = cv2.VideoCapture(index)
        
    if not cap.isOpened():
        print("ERROR: Could not re-open camera.")
        return False
        
    print("Camera re-opened successfully. Reading 5 frames...")
    for i in range(5):
        ret, frame = cap.read()
        if ret and frame is not None:
            print(f"  Frame {i+1} read successfully (shape: {frame.shape})")
        else:
            print(f"  Frame {i+1} FAILED to read")
        time.sleep(0.1)
        
    print("Releasing camera...")
    cap.release()
    print("Camera released. TEST PASSED!")
    return True

if __name__ == "__main__":
    idx = 0
    if len(sys.argv) > 1:
        try:
            idx = int(sys.argv[1])
        except ValueError:
            pass
    test_camera(idx)
