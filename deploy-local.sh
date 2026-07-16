#!/bin/bash

# Deployment script for localComponent (Raspberry Pi)
# Deploys the local ingest process to the on-site Raspberry Pi

set -e  # Exit on any error

# ===========================================
# CONFIGURATION - Update these values
# ===========================================
REMOTE_USER="tonete"
REMOTE_HOST="192.168.1.240"
REMOTE_PATH="/home/tonete/tareasPendientes"

# ===========================================
# Colors for output
# ===========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ===========================================
# Helper functions
# ===========================================
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

ssh_cmd() {
    ssh "$REMOTE_USER@$REMOTE_HOST" "export PATH=\$PATH:/home/tonete/.npm-global/bin && $1"
}

rsync_cmd() {
    rsync -avz --delete "$1" "$REMOTE_USER@$REMOTE_HOST:$2"
}

# ===========================================
# Validate configuration
# ===========================================
if [ "$REMOTE_HOST" = "192.168.1.240" ]; then
    log_warn "Make sure REMOTE_HOST is correct: $REMOTE_HOST"
fi

# ===========================================
# Get script directory (where this project is)
# ===========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log_info "Starting local component deployment from: $SCRIPT_DIR"

# ===========================================
# Step 0: Cross-compile the Go poller for the Pi (aarch64)
# ===========================================
if command -v go >/dev/null 2>&1; then
    log_info "Building Go poller (linux/arm64)..."
    ( cd "$SCRIPT_DIR/localComponent/poller" && \
      GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o bin/huawei-poller ./cmd/huawei-poller ) \
        || { log_error "Go build failed (install Go: brew install go)"; exit 1; }
    chmod +x "$SCRIPT_DIR/localComponent/poller/bin/huawei-poller"
    log_info "Poller built → localComponent/poller/bin/huawei-poller"
else
    log_warn "Go toolchain not found on this machine. Skipping poller build (rsyncing existing binary if present)."
    log_warn "Install go (brew install go) to build the poller."
fi

# ===========================================
# Step 1: Ensure remote directories exist
# ===========================================
log_info "Creating remote directories..."
ssh_cmd "mkdir -p $REMOTE_PATH/localComponent $REMOTE_PATH/localComponent/poller/bin $REMOTE_PATH/logs"

# ===========================================
# Step 2: Deploy root ecosystem config for local
# ===========================================
log_info "Deploying ecosystem config..."
rsync_cmd "ecosystem.local.config.cjs" "$REMOTE_PATH/ecosystem.local.config.cjs"
log_info "Ecosystem config deployed"

# ===========================================
# Step 3: Deploy localComponent code
# (excluding node_modules, .env, logs, data)
# ===========================================
log_info "Deploying localComponent to Raspberry Pi..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.env' \
    --exclude 'logs' \
    --exclude 'data' \
    --exclude 'shelly.json' \
    "$SCRIPT_DIR/localComponent/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/localComponent/"
log_info "localComponent deployed"

# ===========================================
# Step 3b: Deploy the cross-compiled poller binary
# ===========================================
log_info "Deploying poller binary to Raspberry Pi..."
rsync -avz \
    "$SCRIPT_DIR/localComponent/poller/bin/huawei-poller" \
    "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/localComponent/poller/bin/huawei-poller"
log_info "Poller binary deployed"

# ===========================================
# Step 4: .env management — create or merge
# ===========================================
log_info "Checking .env file on Raspberry Pi..."
if ssh_cmd "[ ! -f $REMOTE_PATH/localComponent/.env ]"; then
    log_warn ".env file not found. Creating from .env.example..."
    ssh_cmd "cp $REMOTE_PATH/localComponent/.env.example $REMOTE_PATH/localComponent/.env"
    log_warn "========================================="
    log_warn "IMPORTANT: Edit the .env file on the Pi before the process can run!"
    log_warn "  ssh $REMOTE_USER@$REMOTE_HOST 'nano $REMOTE_PATH/localComponent/.env'"
    log_warn "========================================="
else
    log_info ".env file exists — merging new variables if missing..."
    # Append any new vars from .env.example that aren't already in .env.
    # This preserves existing values (API_KEY, BACKEND_URL, etc.) while adding
    # new ones introduced by the poller/forwarder migration (POLLER_URL, MAX_AGE_MS, etc.).
    ssh_cmd "cd $REMOTE_PATH/localComponent && \
        while IFS='=' read -r key defaultval; do \
            case \"\$key\" in ''|'#'*) continue;; esac; \
            if ! grep -q \"^\${key}=\" .env; then \
                echo \"\${key}=\${defaultval}\" >> .env; \
                echo \"  + added \${key}\"; \
            fi; \
        done < .env.example"
    log_info ".env merge complete"
fi

# ===========================================
# Step 4b: shelly.json management — create from example if missing
# ===========================================
log_info "Checking shelly.json on Raspberry Pi..."
if ssh_cmd "[ ! -f $REMOTE_PATH/localComponent/shelly.json ]"; then
    log_warn "shelly.json not found. Creating from shelly.example.json..."
    ssh_cmd "cp $REMOTE_PATH/localComponent/shelly.example.json $REMOTE_PATH/localComponent/shelly.json"
    log_warn "========================================="
    log_warn "IMPORTANT: Edit shelly.json on the Pi with real Shelly LAN IPs!"
    log_warn "  ssh $REMOTE_USER@$REMOTE_HOST 'nano $REMOTE_PATH/localComponent/shelly.json'"
    log_warn "========================================="
else
    log_info "shelly.json exists — preserving"
fi

# ===========================================
# Step 5: Install dependencies on the Pi
# ===========================================
log_info "Installing dependencies on Raspberry Pi..."
ssh_cmd "cd $REMOTE_PATH/localComponent && npm install --production"
log_info "Dependencies installed"

# ===========================================
# Step 6: Stop the old local-ingest process (if running)
#         before starting the new poller + forwarder.
#         Both the old ingest and the new poller would fight for the
#         dongle's single Modbus connection, so the old one must be
#         stopped first.
# ===========================================
log_info "Stopping old local-ingest (if running)..."
ssh_cmd "pm2 delete local-ingest 2>/dev/null || true"
log_info "Old local-ingest stopped (or was not running)"

# ===========================================
# Step 7: Start local poller + forwarder with PM2
# ===========================================
log_info "Starting local poller + forwarder..."
ssh_cmd "cd $REMOTE_PATH && (pm2 restart ecosystem.local.config.cjs --update-env 2>/dev/null || pm2 start ecosystem.local.config.cjs)"
ssh_cmd "pm2 save 2>/dev/null || true"
log_info "Local poller + forwarder (re)started"

# ===========================================
# Done!
# ===========================================
echo ""
log_info "========================================="
log_info "Deployment complete!"
log_info "========================================="
echo ""
log_info "Check status with:     ssh $REMOTE_USER@$REMOTE_HOST 'pm2 status'"
log_info "Poller snapshot:       ssh $REMOTE_USER@$REMOTE_HOST 'curl -s http://127.0.0.1:8765/snapshot | head -5'"
log_info "Shelly status:         ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs local-shelly-forwarder --lines 20'"
log_info "View logs with:         ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs local-poller local-forwarder local-shelly-forwarder'"
log_info "Manual restart:         ssh $REMOTE_USER@$REMOTE_HOST 'pm2 restart local-poller local-forwarder local-shelly-forwarder'"
log_info "Verify old ingest gone: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 list | grep local-ingest || echo OK'"
