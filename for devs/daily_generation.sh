#!/bin/bash
# Script for automatic daily execution of Stable Diffusion 3.5

# CONFIGURATION
# The project path is derived automatically from the script location.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$SCRIPT_DIR}"
VENV_PATH="${VENV_PATH:-$PROJECT_DIR/sd3-env}"
SCRIPT_PATH="${SCRIPT_PATH:-$PROJECT_DIR/main.py}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/secrets.env}"
FALLBACK_ENV="${FALLBACK_ENV:-$PROJECT_DIR/.env}"

# Default values that are overridden by environment variables when present.
DEFAULT_S3_BUCKET="artipop-storage"
DEFAULT_S3_REGION="eu-central-1"

# Create log directory if it does not exist
mkdir -p "$LOG_DIR"

# Timestamped log file
LOG_FILE="$LOG_DIR/sd3_$(date +%Y%m%d_%H%M%S).log"

# File to store generated URLs
URLS_FILE="$LOG_DIR/generated_urls.txt"

# Logging helper
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Starting daily SD3 generation"
log "=========================================="

# Function to load .env files while keeping variables exported.
load_env_file() {
    local file="$1"
    if [ -f "$file" ]; then
        set -a
        # shellcheck disable=SC1090
        . "$file"
        set +a
        log "✓ Environment variables loaded from $(basename "$file")"
    fi
}

# Activate virtual environment
source "$VENV_PATH/bin/activate"
if [ $? -ne 0 ]; then
    log "ERROR: Failed to activate virtual environment"
    exit 1
fi
log "✓ Virtual environment activated"

# Load environment variables from the preferred file and the fallback, if present.
load_env_file "$ENV_FILE"
load_env_file "$FALLBACK_ENV"

# Apply default values if missing after loading variables.
S3_BUCKET="${S3_BUCKET:-$DEFAULT_S3_BUCKET}"
S3_REGION="${S3_REGION:-$DEFAULT_S3_REGION}"

# Array of daily prompts (automatically rotates)
PROMPTS=(
    "a serene mountain landscape at sunrise, photorealistic, 8k"
    "futuristic cityscape with flying cars, cyberpunk style, neon lights"
    "ancient library with magical books, fantasy art, detailed"
    "underwater coral reef with exotic fish, vibrant colors, nature photography"
    "steampunk workshop with intricate machines, Victorian era"
    "zen garden with cherry blossoms, peaceful atmosphere, Japanese style"
    "space station orbiting alien planet, sci-fi, detailed architecture"
)

# Select prompt based on the day of the year
DAY_OF_YEAR=$(date +%j)
PROMPT_INDEX=$((DAY_OF_YEAR % ${#PROMPTS[@]}))
DAILY_PROMPT="${PROMPTS[$PROMPT_INDEX]}"

log "Selected prompt: $DAILY_PROMPT"

# Run generation with the main script
log "Starting image generation..."

# Capture all output into a variable
OUTPUT=$(python3 "$SCRIPT_PATH" \
    --bucket "$S3_BUCKET" \
    --prompt "$DAILY_PROMPT" \
    --organized \
    --public \
    --region "$S3_REGION" \
    --steps 28 \
    --guidance 3.5 \
    --seed $(($(date +%s) % 999999)) \
    2>&1)

EXIT_CODE=$?

# Write output to the log
echo "$OUTPUT" >> "$LOG_FILE"

# Extract information from the output
S3_URI=$(echo "$OUTPUT" | grep "^s3://" | tail -1)
PUBLIC_URL=$(echo "$OUTPUT" | grep "Public URL:" | awk '{print $3}')
FILENAME=$(echo "$OUTPUT" | grep "Filename:" | awk '{print $2}')
GENERATED_AT=$(echo "$OUTPUT" | grep "Generated:" | awk '{print $2}')

if [ $EXIT_CODE -eq 0 ]; then
    log "✓ Generation completed successfully"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "📁 S3 URI:      $S3_URI"
    log "📄 Filename:    $FILENAME"
    log "📅 Generated:   $GENERATED_AT"
    
    if [ -n "$PUBLIC_URL" ]; then
        log "🌐 Public URL:  $PUBLIC_URL"
        
        # Save URL to history file
        echo "$(date '+%Y-%m-%d %H:%M:%S') | $PUBLIC_URL | $DAILY_PROMPT" >> "$URLS_FILE"
        log "✓ URL saved to $URLS_FILE"
        
        # Send notification with URL (optional)
        send_notification "success" "$PUBLIC_URL" "$DAILY_PROMPT"
    else
        log "⚠️  Image is private (no public URL)"
    fi
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
else
    log "✗ Generation failed with exit code $EXIT_CODE"
    log "Error details:"
    echo "$OUTPUT" | grep -i "error" >> "$LOG_FILE"
    
    # Send error notification
    send_notification "error" "Exit code: $EXIT_CODE"
fi

# Clean up old logs (keep the last 30 days)
find "$LOG_DIR" -name "sd3_*.log" -mtime +30 -delete
log "✓ Old logs cleaned up"

log "=========================================="
log "Daily generation completed"
log "=========================================="

exit $EXIT_CODE

# ========================================
# NOTIFICATION FUNCTIONS (optional)
# ========================================

send_notification() {
    local status="$1"
    local message="$2"
    local prompt="$3"
    
    # Uncomment and configure the preferred method:
    
    # --- TELEGRAM ---
    # if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    #     if [ "$status" = "success" ]; then
    #         curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendPhoto" \
    #             -F "chat_id=$TELEGRAM_CHAT_ID" \
    #             -F "photo=$message" \
    #             -F "caption=🎨 Daily SD3 Image\n\n$prompt\n\n🔗 $message" \
    #             > /dev/null
    #     else
    #         curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    #             -F "chat_id=$TELEGRAM_CHAT_ID" \
    #             -F "text=❌ SD3 Generation Failed\n\n$message" \
    #             > /dev/null
    #     fi
    # fi
    
    # --- SLACK ---
    # if [ -n "$SLACK_WEBHOOK_URL" ]; then
    #     if [ "$status" = "success" ]; then
    #         curl -s -X POST "$SLACK_WEBHOOK_URL" \
    #             -H 'Content-Type: application/json' \
    #             -d "{\"text\":\"🎨 Daily SD3 Image Generated\",\"attachments\":[{\"title\":\"$prompt\",\"image_url\":\"$message\"}]}" \
    #             > /dev/null
    #     else
    #         curl -s -X POST "$SLACK_WEBHOOK_URL" \
    #             -H 'Content-Type: application/json' \
    #             -d "{\"text\":\"❌ SD3 Generation Failed: $message\"}" \
    #             > /dev/null
    #     fi
    # fi
    
    # --- EMAIL (with AWS SES) ---
    # if [ "$status" = "success" ]; then
    #     aws ses send-email \
    #         --from "noreply@yourdomain.com" \
    #         --to "your@email.com" \
    #         --subject "Daily SD3 Image Generated" \
    #         --text "View image: $message\n\nPrompt: $prompt" \
    #         --region "$S3_REGION" \
    #         > /dev/null 2>&1
    # fi
    
    # --- DISCORD ---
    # if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    #     if [ "$status" = "success" ]; then
    #         curl -s -X POST "$DISCORD_WEBHOOK_URL" \
    #             -H "Content-Type: application/json" \
    #             -d "{\"content\":\"🎨 Daily SD3 Image\",\"embeds\":[{\"title\":\"$prompt\",\"image\":{\"url\":\"$message\"}}]}" \
    #             > /dev/null
    #     fi
    # fi
    
    return 0
}
