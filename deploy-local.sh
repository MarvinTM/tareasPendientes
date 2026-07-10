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
# Get script directory (where the project is)
# ===========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log_info "Starting local component deployment from: $SCRIPT_DIR"

# ===========================================
# Step 1: Ensure remote directories exist
# ===========================================
log_info "Creating remote directories..."
ssh_cmd "mkdir -p $REMOTE_PATH/localComponent $REMOTE_PATH/logs"

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
    "$SCRIPT_DIR/localComponent/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/localComponent/"
log_info "localComponent deployed"

# ===========================================
# Step 4: Create .env from example on first deploy
# ===========================================
log_info "Checking for .env file on Raspberry Pi..."
if ssh_cmd "[ ! -f $REMOTE_PATH/localComponent/.env ]"; then
    log_warn ".env file not found. Creating from .env.example..."
    ssh_cmd "cp $REMOTE_PATH/localComponent/.env.example $REMOTE_PATH/localComponent/.env"
    log_warn "========================================="
    log_warn "IMPORTANT: Edit the .env file on the Pi before the process can run!"
    log_warn "  ssh $REMOTE_USER@$REMOTE_HOST 'nano $REMOTE_PATH/localComponent/.env'"
    log_warn "Then run deploy again or:"
    log_warn "  ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && pm2 restart ecosystem.local.config.cjs'"
    log_warn "========================================="
else
    log_info ".env file already exists, skipping"
fi

# ===========================================
# Step 5: Install dependencies on the Pi
# ===========================================
log_info "Installing dependencies on Raspberry Pi..."
ssh_cmd "cd $REMOTE_PATH/localComponent && npm install --production"
log_info "Dependencies installed"

# ===========================================
# Step 6: Restart local ingest with PM2
# ===========================================
log_info "Restarting local ingest..."
ssh_cmd "cd $REMOTE_PATH && pm2 restart ecosystem.local.config.cjs --update-env || pm2 start ecosystem.local.config.cjs"
log_info "Local ingest (re)started"

# ===========================================
# Done!
# ===========================================
echo ""
log_info "========================================="
log_info "Deployment complete!"
log_info "========================================="
echo ""
log_info "Check status with: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 status'"
log_info "View logs with:    ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs local-ingest'"
log_info "Manual restart:    ssh $REMOTE_USER@$REMOTE_HOST 'pm2 restart local-ingest'"
