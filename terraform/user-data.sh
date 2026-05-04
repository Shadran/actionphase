#!/bin/bash

# ActionPhase EC2 User Data Script
# This script runs automatically when the EC2 instance is created
# It installs Docker, Docker Compose, and prepares the server for deployment

set -e

# Log all output
exec > >(tee -a /var/log/user-data.log)
exec 2>&1

echo "=========================================="
echo "Starting ActionPhase server setup..."
echo "Date: $(date)"
echo "=========================================="

# Update system
echo "Updating system packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# Install required packages
echo "Installing required packages..."
apt-get install -y \
    curl \
    git \
    wget \
    unzip \
    htop \
    vim \
    ufw \
    fail2ban \
    unattended-upgrades \
    software-properties-common \
    ca-certificates \
    gnupg \
    lsb-release \
    postgresql-client

# Install Docker
echo "Installing Docker..."
curl -fsSL https://get.docker.com | sh

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Install Docker Compose
echo "Installing Docker Compose..."
COMPOSE_VERSION="2.40.3"
curl -L "https://github.com/docker/compose/releases/download/v$${COMPOSE_VERSION}/docker-compose-linux-aarch64" \
    -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install just task runner
echo "Installing just..."
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# Install AWS CLI
echo "Installing AWS CLI..."
cd /tmp
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install
cd /

# Configure firewall
echo "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

# Configure fail2ban for SSH protection
echo "Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Configure automatic security updates
echo "Configuring automatic security updates..."
echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades
DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true dpkg-reconfigure --priority=low unattended-upgrades

# Create application directory
echo "Creating application directory..."
mkdir -p /opt/actionphase
chown ubuntu:ubuntu /opt/actionphase

# Clone repository (if GitHub repo is provided)
if [ -n "${github_repo}" ]; then
    echo "Cloning repository..."
    cd /opt/actionphase
    sudo -u ubuntu git clone ${github_repo} .

    # Create .env file template
    if [ -f .env.docker ]; then
        cp .env.docker .env

        # Generate JWT secret
        JWT_SECRET=$(openssl rand -base64 32)
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env

        # Set domain if provided
        if [ -n "${domain}" ]; then
            sed -i "s|DOMAIN=.*|DOMAIN=${domain}|" .env
            echo "${domain}" > /opt/actionphase/.domain
        fi

        # Set admin email if provided
        if [ -n "${admin_email}" ]; then
            sed -i "s|ADMIN_EMAIL=.*|ADMIN_EMAIL=${admin_email}|" .env
        fi
    fi
else
    echo "No GitHub repo provided, skipping clone"
fi

# Create required directories
echo "Creating required directories..."
mkdir -p /opt/actionphase/{backups,scripts,nginx,ssl}
mkdir -p /opt/actionphase/logs/{backend,frontend,nginx,postgres,backup}
chown -R ubuntu:ubuntu /opt/actionphase

# Create systemd service for Docker Compose (optional)
cat > /etc/systemd/system/actionphase.service << 'EOF'
[Unit]
Description=ActionPhase Docker Compose Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/actionphase
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
ExecReload=/usr/local/bin/docker-compose restart

[Install]
WantedBy=multi-user.target
EOF

# Generate Diffie-Hellman parameters for SSL
echo "Generating DH parameters for SSL (this may take a few minutes)..."
openssl dhparam -out /opt/actionphase/ssl/dhparam.pem 2048

# Create cron jobs for backups and monitoring
echo "Setting up backup and monitoring cron jobs..."
cat > /etc/cron.d/actionphase << 'EOF'
# Daily database backup at 2 AM UTC
0 2 * * * ubuntu cd /opt/actionphase && ./scripts/backup-to-s3.sh >> /opt/actionphase/backups/backup.log 2>&1

# Weekly AMI snapshot at 3 AM UTC on Sundays
0 3 * * 0 root /usr/local/bin/aws ec2 create-image --instance-id $(ec2-metadata --instance-id | cut -d " " -f 2) --name "actionphase-ami-$(date +\%Y\%m\%d)" --no-reboot >> /var/log/ami-snapshot.log 2>&1

# Daily disk space monitoring at 6 AM UTC
0 6 * * * ubuntu cd /opt/actionphase && ./scripts/check-disk.sh --threshold 70 >> /opt/actionphase/logs/disk-monitor.log 2>&1

# Weekly SSL certificate check at 7 AM UTC on Mondays
0 7 * * 1 ubuntu cd /opt/actionphase && ./scripts/check-ssl.sh >> /opt/actionphase/logs/ssl-monitor.log 2>&1

# Clean old Docker resources weekly at 4 AM UTC on Sundays
0 4 * * 0 ubuntu docker system prune -f >> /var/log/docker-cleanup.log 2>&1
EOF

# Install ec2-metadata tool
echo "Installing ec2-metadata tool..."
wget -q http://s3.amazonaws.com/ec2metadata/ec2-metadata -O /usr/local/bin/ec2-metadata
chmod +x /usr/local/bin/ec2-metadata

# Set up log rotation
echo "Configuring log rotation..."
cat > /etc/logrotate.d/actionphase << 'EOF'
# Backend application logs - copytruncate because Go holds the file open
/opt/actionphase/logs/backend/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}

# Postgres logs - managed by postgres logging_collector, just rotate the files
/opt/actionphase/logs/postgres/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}

# Nginx reverse proxy logs - signal nginx to reopen after rotate
/opt/actionphase/logs/nginx/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 ubuntu ubuntu
    sharedscripts
    postrotate
        docker kill --signal=USR1 actionphase-nginx 2>/dev/null || true
    endscript
}

# Frontend nginx logs
/opt/actionphase/logs/frontend/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 ubuntu ubuntu
    sharedscripts
    postrotate
        docker kill --signal=USR1 actionphase-frontend 2>/dev/null || true
    endscript
}

# Backup logs
/opt/actionphase/backups/*.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 644 ubuntu ubuntu
}
EOF

# Create MOTD with deployment instructions
echo "Creating MOTD..."
cat > /etc/motd << 'EOF'
========================================
   ActionPhase Production Server
========================================

Quick Commands:
  cd /opt/actionphase       - Go to application directory
  just --list               - Show available commands
  just deploy               - Deploy latest changes
  docker-compose ps         - View container status
  docker-compose logs -f    - View logs

First-time setup:
  1. cd /opt/actionphase
  2. Edit .env file with production values
  3. ./docker-setup.sh
  4. ./scripts/setup-ssl.sh your-domain.com

Documentation: .claude/planning/PRODUCTION_DEPLOYMENT.md
========================================
EOF

# Final message
echo ""
echo "=========================================="
echo "✓ Server setup complete!"
echo "=========================================="
echo "Docker version: $(docker --version)"
echo "Docker Compose: $(docker-compose --version)"
echo "AWS CLI: $(aws --version)"
echo ""
echo "Next steps:"
echo "  1. SSH to server: ssh ubuntu@$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "  2. cd /opt/actionphase"
echo "  3. Configure .env file"
echo "  4. Run ./docker-setup.sh"
echo ""
echo "Setup log: /var/log/user-data.log"
echo "=========================================="
