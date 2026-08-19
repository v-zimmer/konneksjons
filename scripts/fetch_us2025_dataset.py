"""
Download the IKEA US 2025 full-catalog dataset (~49MB JSONL, MIT licensed)
from Hugging Face into data/raw/. Not committed to git (too big / easily
re-fetched) - rerun this script any time you need it back.

Source: https://huggingface.co/datasets/jeffreyszhou/ikea-us-products-2025
~30,500 products scraped from ikea.com/us in July 2025, covering all
departments (not just furniture): kitchen, lighting, bathroom, textiles,
plants, baby & kids, decor, etc.
"""
import urllib.request
from pathlib import Path

URL = "https://huggingface.co/datasets/jeffreyszhou/ikea-us-products-2025/resolve/main/products-us.jsonl"
OUT = Path(__file__).parent.parent / "data" / "raw" / "ikea_us_2025_products.jsonl"


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {URL} -> {OUT}")
    urllib.request.urlretrieve(URL, OUT)
    print(f"Done: {OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
