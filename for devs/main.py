#!/usr/bin/env python3
import os
os.environ.setdefault("HF_HOME", "/opt/hf-cache")

import sys
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime
import argparse
import io

# Load environment variables from a .env file (default: secrets.env)
def _load_env_file(path: Path):
    if not path.exists():
        return
    try:
        for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            # don't overwrite if already set in the environment
            os.environ.setdefault(k, v)
    except Exception as _e:
        # fail soft — just log later when logger is ready
        pass

_ENV_FILE = os.getenv("ENV_FILE", "secrets.env")
_load_env_file(Path(_ENV_FILE))

# Compatibility shims
if os.getenv("HF_TOKEN") and not os.getenv("HUGGINGFACE_HUB_TOKEN"):
    os.environ["HUGGINGFACE_HUB_TOKEN"] = os.environ["HF_TOKEN"]
if os.getenv("AWS_DEFAULT_REGION") and not os.getenv("AWS_REGION"):
    os.environ["AWS_REGION"] = os.environ["AWS_DEFAULT_REGION"]

import boto3
from botocore.exceptions import ClientError
import replicate
from PIL import Image
from PIL.PngImagePlugin import PngInfo

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

MODEL_ID = "stability-ai/stable-diffusion-3.5-large"

def get_replicate_token() -> str:
    """Retrieve the Replicate token from environment variables."""
    token = os.getenv("REPLICATE_API_TOKEN")
    if not token:
        raise ValueError(
            "Replicate API token not found. Set REPLICATE_API_TOKEN in your .env file or environment."
        )
    return token

def generate_image_with_replicate(
    prompt: str,
    steps: int = 28,          # not used by this model (kept for compatibility)
    guidance: float = 3.5,    # mapped to "cfg"
    seed: Optional[int] = None,
    width: int = 1024,
    height: int = 1024,
    output_format: str = "png"
) -> Image.Image:
    token = get_replicate_token()
    client = replicate.Client(api_token=token)

    # width/height -> aspect_ratio (Replicate schema)
    from math import gcd
    g = gcd(max(width,1), max(height,1))
    ar = f"{width//g}:{height//g}"

    inputs = {
        "prompt": prompt,
        "cfg": guidance,
        "output_format": output_format,
    }
    if seed is not None:
        inputs["seed"] = seed
    if ar != "1:1":
        inputs["aspect_ratio"] = ar

    logger.info(f"Generating with cfg={guidance}, aspect_ratio={inputs.get('aspect_ratio','1:1')}")
    try:
        out = client.run(MODEL_ID, input=inputs)

        # normalize: it can be a FileOutput or URL string
        fo = out[0] if isinstance(out, list) else out
        if hasattr(fo, "read"):
            data = fo.read()
        elif isinstance(fo, str):
            import requests
            r = requests.get(fo); r.raise_for_status()
            data = r.content
        else:
            raise RuntimeError(f"Unexpected output type: {type(fo)}")

        return Image.open(io.BytesIO(data))
    except Exception as e:
        msg = str(e)
        if "404" in msg:
            logger.error("Model slug not found: use 'stability-ai/stable-diffusion-3.5-large'")
        elif "401" in msg or "unauthorized" in msg.lower():
            raise ValueError("Invalid Replicate token (REPLICATE_API_TOKEN).")
        raise

def create_filename_with_date(prefix: str = "sd3") -> str:
    """
    Generate a filename with a timestamp.
    Example: sd3_2025-10-13.png
    """
    timestamp = datetime.now().strftime("%Y-%m-%d")
    return f"{prefix}_{timestamp}.png"

def create_s3_key_organized(base_path: str = "images") -> str:
    """
    Create an S3 key organized by year/month/day.
    Example: images/2025/10/13/sd3_2025-10-13_143052.png
    """
    now = datetime.now()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")
    filename = create_filename_with_date()
    
    return f"{base_path}/{year}/{month}/{day}/{filename}"

def add_metadata_to_image(
    image: Image.Image,
    prompt: str,
    steps: int,
    guidance: float,
    seed: Optional[int] = None
) -> tuple[Image.Image, PngInfo]:
    """Add PNG metadata to the image."""
    metadata = PngInfo()
    
    metadata.add_text("prompt", prompt)
    metadata.add_text("steps", str(steps))
    metadata.add_text("guidance_scale", str(guidance))
    if seed:
        metadata.add_text("seed", str(seed))
    
    metadata.add_text("generated_at", datetime.now().isoformat())
    metadata.add_text("model", "stable-diffusion-3.5-large")
    metadata.add_text("generator", "replicate-client")
    
    return image, metadata

def upload_to_s3(
    local_path: Path,
    bucket: str,
    key: str,
    prompt: str,
    steps: int,
    guidance: float,
    seed: Optional[int],
    region: Optional[str] = None,
    public: bool = False
) -> dict:
    """
    Upload to S3 with metadata and optional public URL handling.
    Return a dictionary with all the information.
    """
    s3 = boto3.client("s3", region_name=region)
    region = region or "eu-central-1"
    
    # S3 metadata (visible in the object properties)
    s3_metadata = {
        "prompt": prompt[:1024],  # S3 limits metadata entries to 2KB
        "steps": str(steps),
        "guidance": str(guidance),
        "generated-at": datetime.now().isoformat(),
        "model": "stable-diffusion-3.5-large",
        "generator": "replicate-client"
    }
    if seed:
        s3_metadata["seed"] = str(seed)
    
    # Extra parameters for the upload
    extra_args = {
        "ContentType": "image/png",
        "Metadata": s3_metadata,
        "CacheControl": "public, max-age=31536000",  # Cache for 1 year
    }
    

    try:
        logger.info(f"Uploading to s3://{bucket}/{key}")
        s3.upload_file(str(local_path), bucket, key, ExtraArgs=extra_args)
        
        # Generate URLs
        s3_uri = f"s3://{bucket}/{key}"
        public_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
        
        result = {
            "s3_uri": s3_uri,
            "public_url": public_url,
            "key": key,
            "filename": Path(key).name,
            "bucket": bucket,
            "region": region,
            "is_public": public,
            "generated_at": datetime.now().isoformat(),
            "prompt": prompt,
            "metadata": s3_metadata
        }
        
        logger.info(f"Upload successful: {s3_uri}")
        if public:
            logger.info(f"Public URL: {public_url}")
        
        return result
    
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchBucket':
            logger.error(f"Bucket '{bucket}' does not exist")
        elif error_code == 'AccessDenied':
            logger.error("Access denied. Check AWS credentials and bucket permissions")
        else:
            logger.error(f"S3 upload failed: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(
        description="Generate images with Stable Diffusion 3.5 via Replicate API and upload to S3"
    )
    parser.add_argument("--bucket", default=os.getenv("S3_BUCKET"), help="S3 bucket name (default from S3_BUCKET)")
    parser.add_argument("--prompt", required=True, help="Text prompt for generation")
    parser.add_argument("--key", help="S3 key (optional, auto-generated with date if not provided)")
    parser.add_argument("--organized", action="store_true", 
                       help="Organize files by date (images/YYYY/MM/DD/filename.png)")
    parser.add_argument("--steps", type=int, default=28, help="Inference steps")
    parser.add_argument("--guidance", type=float, default=3.5, help="Guidance scale")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    parser.add_argument("--width", type=int, default=1024, help="Image width")
    parser.add_argument("--height", type=int, default=1024, help="Image height")
    parser.add_argument("--region", default=os.getenv("AWS_DEFAULT_REGION"), help="AWS region (default from AWS_DEFAULT_REGION, else eu-central-1)")
    parser.add_argument("--public", action="store_true", 
                       help="Make image publicly accessible via URL")
    args = parser.parse_args()
    
    # Resolve bucket from env if not provided, and fail fast if missing
    if not args.bucket:
        parser.error("Missing --bucket and S3_BUCKET not set in environment (.env)")
    
    # Info for debugging env loading
    logger.info(f"Using bucket: {args.bucket}")
    if not args.region:
        logger.info("No region via args/env; will fall back to eu-central-1 inside S3 client")

    try:
        # Check the Replicate token
        _ = get_replicate_token()
        logger.info("✓ Replicate token found")
        
        # Generate image via Replicate client
        img = generate_image_with_replicate(
            prompt=args.prompt,
            steps=args.steps,
            guidance=args.guidance,
            seed=args.seed,
            width=args.width,
            height=args.height,
        )
        
        # Add metadata to image
        img, png_metadata = add_metadata_to_image(
            img,
            prompt=args.prompt,
            steps=args.steps,
            guidance=args.guidance,
            seed=args.seed
        )

        # Determine S3 key
        if args.key:
            # Use the key provided by the user
            s3_key = args.key
        elif args.organized:
            # Organize by date: images/2025/10/13/sd3_2025-10-13_143052.png
            s3_key = create_s3_key_organized()
        else:
            # Simple name with date: sd3_2025-10-13_143052.png
            s3_key = create_filename_with_date()
        
        # Save temporarily with metadata
        tmp_path = Path("/tmp") / Path(s3_key).name
        img.save(tmp_path, pnginfo=png_metadata)
        logger.info(f"Image saved temporarily to {tmp_path}")

        # Upload to S3
        result = upload_to_s3(
            tmp_path, 
            args.bucket, 
            key=s3_key,
            prompt=args.prompt,
            steps=args.steps,
            guidance=args.guidance,
            seed=args.seed,
            region=args.region,
            public=args.public
        )
        
        # Cleanup
        tmp_path.unlink()
        logger.info("Temporary file deleted")
        
        # Output the results
        print("\n" + "="*60)
        print("✅ IMAGE GENERATED AND UPLOADED SUCCESSFULLY")
        print("="*60)
        print(f"📁 S3 URI:      {result['s3_uri']}")
        print(f"📄 Filename:    {result['filename']}")
        print(f"📅 Generated:   {result['generated_at']}")
        
        if args.public:
            print(f"🌐 Public URL:  {result['public_url']}")
            print("\n💡 You can share this URL directly!")
        else:
            print("\n💡 Image is private. Use --public flag for public access.")
            print(f"   Or configure bucket policy for public reads.")
        
        print("="*60 + "\n")
        
        # Return only the main URL for script automation
        print(result['s3_uri'])
        
        return 0

    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        return 130
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(main())
