"""Downloads the embedding model while the app is being built.

Run this during the deploy build so the model files end up inside the image.
At runtime the app loads them from the cache instead of downloading them again.
"""

import sys
from pathlib import Path

# Allow running this file directly: python scripts/preload_model.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config  # noqa: E402
from app.embeddings import get_embeddings  # noqa: E402


def main() -> None:
    print(f"HF_HOME          : {config.HF_HOME}")
    print(f"Embedding model  : {config.EMBEDDING_MODEL}")
    get_embeddings()
    print("Embedding model downloaded and ready.")


if __name__ == "__main__":
    main()
