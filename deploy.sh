#!/bin/bash

# Deployment script for Tareas Pendientes
# Builds frontend locally and deploys to production server

set -e  # Exit on any error

# ===========================================
# CONFIGURATION - Update these values
# ===========================================
REMOTE_USER="ubuntu"                              # SSH user on your server
REMOTE_HOST="34.254.228.23"            # Server IP or domain
REMOTE_PATH="/var/www/tareasPendientes"          # Path on server
SSH_KEY="~/alberite.pem.txt"                                        # Optional: path to SSH key (e.g., ~/.ssh/id_rsa)

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

# Build SSH command with optional key
ssh_cmd() {
    if [ -n "$SSH_KEY" ]; then
        ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" "$1"
    else
        ssh "$REMOTE_USER@$REMOTE_HOST" "$1"
    fi
}

# Build rsync command with optional key
rsync_cmd() {
    if [ -n "$SSH_KEY" ]; then
        rsync -avz --delete -e "ssh -i $SSH_KEY" "$1" "$REMOTE_USER@$REMOTE_HOST:$2"
    else
        rsync -avz --delete "$1" "$REMOTE_USER@$REMOTE_HOST:$2"
    fi
}

# ===========================================
# Validate configuration
# ===========================================
if [ "$REMOTE_HOST" = "your-server-ip-or-domain" ]; then
    log_error "Please update REMOTE_HOST in deploy.sh with your server address"
    exit 1
fi

# ===========================================
# Get script directory (where the project is)
# ===========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log_info "Starting deployment from: $SCRIPT_DIR"

# ===========================================
# Step 1: Build frontend locally
# ===========================================
log_info "Building frontend..."
cd frontend
npm run build
cd ..
log_info "Frontend build complete"

# ===========================================
# Step 2: Deploy frontend dist
# ===========================================
log_info "Deploying frontend to server..."
rsync_cmd "frontend/dist/" "$REMOTE_PATH/frontend/dist/"
log_info "Frontend deployed"

# ===========================================
# Step 3: Deploy backend code (excluding node_modules)
# ===========================================
log_info "Deploying backend to server..."
if [ -n "$SSH_KEY" ]; then
    rsync -avz --delete \
        --exclude 'node_modules' \
        --exclude '.env' \
        --exclude 'logs' \
        -e "ssh -i $SSH_KEY" \
        backend/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/backend/"
else
    rsync -avz --delete \
        --exclude 'node_modules' \
        --exclude '.env' \
        --exclude 'logs' \
        backend/ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/backend/"
fi
log_info "Backend deployed"

# ===========================================
# Step 4: Install backend dependencies on server
# ===========================================
log_info "Installing backend dependencies on server..."
ssh_cmd "cd $REMOTE_PATH/backend && npm install --production"
log_info "Dependencies installed"

# ===========================================
# Step 5: Run database migrations
# ===========================================
log_info "Running database migrations..."
ssh_cmd "cd $REMOTE_PATH/backend && npm run db:push"
log_info "Database updated"

# ===========================================
# Step 6: Restart backend with PM2
# ===========================================
log_info "Restarting backend..."
ssh_cmd "cd $REMOTE_PATH && pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs"
log_info "Backend restarted"

# ===========================================
# Done!
# ===========================================
echo ""
log_info "========================================="
log_info "Deployment complete!"
log_info "========================================="
echo ""
log_info "Check status with: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 status'"
log_info "View logs with:    ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs tareas-backend'"
