import unittest
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from test_api import TestSliceCraftAPI

if __name__ == "__main__":
    unittest.main()
