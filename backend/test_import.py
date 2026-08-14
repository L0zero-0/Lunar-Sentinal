import sys
print("Python Version:", sys.version)
print("Python Path:", sys.path)

try:
    print("Importing main...")
    import main
    print("Successfully imported main!")
except Exception as e:
    import traceback
    traceback.print_exc()
