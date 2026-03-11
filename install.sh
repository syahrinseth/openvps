#!/bin/bash
set -e

#=============================================================================
# OpenVPS - VPS Installation Script
# For Ubuntu 24.04 LTS
# Run as root: bash install.sh
#=============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root: sudo bash install.sh"
    exit 1
fi

print_header "OpenVPS Installation"
echo "This script will install and configure OpenVPS on your server."
echo ""

#=============================================================================
# Configuration
#=============================================================================
INSTALL_DIR="/opt/openvps"
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
DB_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
APP_KEY=""
SERVER_IP=$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo -e "Server IP detected: ${GREEN}${SERVER_IP}${NC}"
echo ""

#=============================================================================
# Step 1: System Update & Dependencies
#=============================================================================
print_header "Step 1: Updating system & installing dependencies"

apt-get update -y
apt-get upgrade -y
apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    htop \
    net-tools

print_success "System updated and dependencies installed"

#=============================================================================
# Step 2: Install Docker
#=============================================================================
print_header "Step 2: Installing Docker"

if command -v docker &> /dev/null; then
    print_warning "Docker already installed, skipping..."
else
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker

    print_success "Docker installed"
fi

# Verify Docker
docker --version
docker compose version

print_success "Docker is ready"

#=============================================================================
# Step 3: Install Node.js (for building frontend)
#=============================================================================
print_header "Step 3: Installing Node.js 22 LTS"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_warning "Node.js ${NODE_VERSION} already installed"
else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
    print_success "Node.js installed: $(node --version)"
fi

#=============================================================================
# Step 4: Configure Firewall
#=============================================================================
print_header "Step 4: Configuring Firewall (UFW)"

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable

print_success "Firewall configured (SSH, HTTP, HTTPS allowed)"

#=============================================================================
# Step 5: Configure Fail2Ban
#=============================================================================
print_header "Step 5: Configuring Fail2Ban"

cat > /etc/fail2ban/jail.local << 'FAIL2BAN'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
FAIL2BAN

systemctl enable fail2ban
systemctl restart fail2ban

print_success "Fail2Ban configured"

#=============================================================================
# Step 6: Clone/Setup OpenVPS
#=============================================================================
print_header "Step 6: Setting up OpenVPS application"

# Create install directory
mkdir -p ${INSTALL_DIR}

# If git repo exists, clone it. Otherwise, copy from current directory.
if [ -d "/tmp/open-vps" ]; then
    cp -r /tmp/open-vps/* ${INSTALL_DIR}/
    cp -r /tmp/open-vps/.* ${INSTALL_DIR}/ 2>/dev/null || true
    print_success "Copied from /tmp/open-vps"
elif [ -d "$(dirname "$0")/backend" ]; then
    # Running from project directory
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    cp -r "${SCRIPT_DIR}"/* ${INSTALL_DIR}/
    cp -r "${SCRIPT_DIR}"/.* ${INSTALL_DIR}/ 2>/dev/null || true
    print_success "Copied from project directory"
else
    print_error "Project files not found. Please either:"
    echo "  1. Clone the repo to /tmp/open-vps first"
    echo "  2. Run this script from the project root directory"
    exit 1
fi

cd ${INSTALL_DIR}

#=============================================================================
# Step 7: Create Production .env
#=============================================================================
print_header "Step 7: Creating production environment configuration"

# Generate Laravel APP_KEY
APP_KEY=$(openssl rand -base64 32)

# Create root .env for docker-compose
cat > ${INSTALL_DIR}/.env << ROOTENV
DB_DATABASE=openvps
DB_USERNAME=openvps
DB_PASSWORD=${DB_PASSWORD}
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
ROOTENV

# Create backend .env for production
cat > ${INSTALL_DIR}/backend/.env << BACKENDENV
APP_NAME=OpenVPS
APP_ENV=production
APP_KEY=base64:${APP_KEY}
APP_DEBUG=false
APP_URL=http://${SERVER_IP}

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=openvps
DB_USERNAME=openvps
DB_PASSWORD=${DB_PASSWORD}

SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_ENCRYPT=true
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=redis

CACHE_STORE=redis

REDIS_CLIENT=phpredis
REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=log
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="noreply@${SERVER_IP}"
MAIL_FROM_NAME="\${APP_NAME}"

FRONTEND_URL=http://${SERVER_IP}
SANCTUM_STATEFUL_DOMAINS=${SERVER_IP}
BACKENDENV

print_success "Environment files created"

#=============================================================================
# Step 8: Build Frontend
#=============================================================================
print_header "Step 8: Building frontend"

cd ${INSTALL_DIR}/frontend
npm install
npm run build

print_success "Frontend built successfully"

#=============================================================================
# Step 9: Install Backend Dependencies
#=============================================================================
print_header "Step 9: Installing backend dependencies"

cd ${INSTALL_DIR}/backend
# We need composer for initial setup, Docker will handle the rest
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi
composer install --no-dev --optimize-autoloader --no-interaction

# Set permissions
chown -R www-data:www-data ${INSTALL_DIR}/backend/storage
chown -R www-data:www-data ${INSTALL_DIR}/backend/bootstrap/cache
chmod -R 775 ${INSTALL_DIR}/backend/storage
chmod -R 775 ${INSTALL_DIR}/backend/bootstrap/cache

print_success "Backend dependencies installed"

#=============================================================================
# Step 10: Start Docker Containers
#=============================================================================
print_header "Step 10: Starting Docker containers"

cd ${INSTALL_DIR}

# Build and start containers
docker compose build --no-cache
docker compose up -d

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
sleep 15

# Run migrations and seed
docker compose exec -T backend php artisan migrate --force
docker compose exec -T backend php artisan db:seed --force
docker compose exec -T backend php artisan config:cache
docker compose exec -T backend php artisan route:cache

print_success "Docker containers started"

#=============================================================================
# Step 11: Create Admin User
#=============================================================================
print_header "Step 11: Creating admin user"

ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)

docker compose exec -T backend php artisan tinker --execute="
use App\Models\User;
use Illuminate\Support\Facades\Hash;

\$user = User::create([
    'name' => 'Admin',
    'email' => 'admin@openvps.local',
    'password' => Hash::make('${ADMIN_PASSWORD}'),
    'email_verified_at' => now(),
]);
\$user->assignRole('admin');
echo 'Admin user created successfully';
"

print_success "Admin user created"

#=============================================================================
# Step 12: Create systemd service for auto-start
#=============================================================================
print_header "Step 12: Creating systemd service"

cat > /etc/systemd/system/openvps.service << 'SYSTEMD'
[Unit]
Description=OpenVPS Management Dashboard
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/openvps
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable openvps.service

print_success "Systemd service created and enabled"

#=============================================================================
# Step 13: Create helper scripts
#=============================================================================
print_header "Step 13: Creating helper scripts"

# Update script
cat > ${INSTALL_DIR}/update.sh << 'UPDATESH'
#!/bin/bash
set -e
cd /opt/openvps

echo "Pulling latest changes..."
git pull origin main 2>/dev/null || echo "Not a git repo, skipping pull"

echo "Building frontend..."
cd frontend && npm install && npm run build && cd ..

echo "Updating backend..."
cd backend && composer install --no-dev --optimize-autoloader --no-interaction && cd ..

echo "Rebuilding containers..."
docker compose build
docker compose up -d

echo "Running migrations..."
docker compose exec -T backend php artisan migrate --force
docker compose exec -T backend php artisan config:cache
docker compose exec -T backend php artisan route:cache

echo "Update complete!"
UPDATESH
chmod +x ${INSTALL_DIR}/update.sh

# Backup script
cat > ${INSTALL_DIR}/backup.sh << 'BACKUPSH'
#!/bin/bash
set -e
BACKUP_DIR="/opt/openvps/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ${BACKUP_DIR}

echo "Backing up database..."
docker compose exec -T mysql mysqldump -u openvps -p"${DB_PASSWORD}" openvps > ${BACKUP_DIR}/db_${DATE}.sql

echo "Backing up configuration..."
tar -czf ${BACKUP_DIR}/config_${DATE}.tar.gz \
    /opt/openvps/backend/.env \
    /opt/openvps/.env \
    /opt/openvps/docker/nginx/ \
    /opt/openvps/docker/mysql/

# Keep only last 30 days of backups
find ${BACKUP_DIR} -type f -mtime +30 -delete

echo "Backup completed: ${BACKUP_DIR}"
ls -la ${BACKUP_DIR}/*${DATE}*
BACKUPSH
chmod +x ${INSTALL_DIR}/backup.sh

# Status script
cat > ${INSTALL_DIR}/status.sh << 'STATUSSH'
#!/bin/bash
cd /opt/openvps
echo "=== OpenVPS Status ==="
echo ""
docker compose ps
echo ""
echo "=== Resource Usage ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
STATUSSH
chmod +x ${INSTALL_DIR}/status.sh

# Logs script
cat > ${INSTALL_DIR}/logs.sh << 'LOGSSH'
#!/bin/bash
cd /opt/openvps
SERVICE=${1:-backend}
docker compose logs -f --tail=100 ${SERVICE}
LOGSSH
chmod +x ${INSTALL_DIR}/logs.sh

print_success "Helper scripts created"

#=============================================================================
# Step 14: Setup daily cron for backups
#=============================================================================
print_header "Step 14: Setting up automated backups"

(crontab -l 2>/dev/null; echo "0 3 * * * /opt/openvps/backup.sh >> /var/log/openvps-backup.log 2>&1") | crontab -

print_success "Daily backup cron job added (3:00 AM)"

#=============================================================================
# Installation Complete
#=============================================================================
print_header "Installation Complete!"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  OpenVPS is now running!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  Dashboard URL:  ${BLUE}http://${SERVER_IP}${NC}"
echo ""
echo -e "  Admin Login:"
echo -e "    Email:    ${YELLOW}admin@openvps.local${NC}"
echo -e "    Password: ${YELLOW}${ADMIN_PASSWORD}${NC}"
echo ""
echo -e "  Database Credentials:"
echo -e "    Root Password: ${YELLOW}${DB_ROOT_PASSWORD}${NC}"
echo -e "    User Password: ${YELLOW}${DB_PASSWORD}${NC}"
echo ""
echo -e "  ${RED}IMPORTANT: Save these credentials securely!${NC}"
echo -e "  ${RED}Change the admin password after first login.${NC}"
echo ""
echo -e "  Useful commands:"
echo -e "    ${BLUE}cd /opt/openvps${NC}"
echo -e "    ${BLUE}./status.sh${NC}          - Check container status"
echo -e "    ${BLUE}./logs.sh${NC}            - View backend logs"
echo -e "    ${BLUE}./logs.sh nginx${NC}      - View nginx logs"
echo -e "    ${BLUE}./backup.sh${NC}          - Manual backup"
echo -e "    ${BLUE}./update.sh${NC}          - Update application"
echo -e "    ${BLUE}docker compose ps${NC}    - Container status"
echo -e "    ${BLUE}docker compose restart${NC} - Restart all services"
echo ""

# Save credentials to a file
cat > ${INSTALL_DIR}/CREDENTIALS.txt << CREDS
===========================================
OpenVPS Installation Credentials
Generated: $(date)
===========================================

Dashboard URL: http://${SERVER_IP}

Admin Login:
  Email:    admin@openvps.local
  Password: ${ADMIN_PASSWORD}

Database:
  Host:          mysql (internal) / 127.0.0.1:3306
  Database:      openvps
  User:          openvps
  Password:      ${DB_PASSWORD}
  Root Password: ${DB_ROOT_PASSWORD}

IMPORTANT: Delete this file after saving credentials!
  rm /opt/openvps/CREDENTIALS.txt
===========================================
CREDS
chmod 600 ${INSTALL_DIR}/CREDENTIALS.txt

echo -e "  Credentials saved to: ${YELLOW}/opt/openvps/CREDENTIALS.txt${NC}"
echo -e "  ${RED}Delete this file after saving credentials elsewhere!${NC}"
echo ""
