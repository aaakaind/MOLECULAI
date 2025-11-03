# MOLECULAI Deployment Guide

This guide covers deploying MOLECULAI in various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js** 20.x or higher
- **Docker** 24.x or higher
- **Docker Compose** 2.x or higher
- **Kubernetes** 1.28+ (for K8s deployment)
- **Helm** 3.x (for K8s deployment)
- **PostgreSQL** 16+ (for local development)
- **Redis** 7+ (for local development)

### System Requirements

**Minimum (Development):**
- 4 CPU cores
- 8 GB RAM
- 20 GB disk space

**Recommended (Production):**
- 8+ CPU cores
- 16+ GB RAM
- 100+ GB disk space
- GPU for renderer service (optional)

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/aaakaind/MOLECULAI.git
cd MOLECULAI
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Database Services

```bash
# Using Docker
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=moleculai \
  --name moleculai-postgres \
  postgres:16-alpine

docker run -d -p 6379:6379 \
  --name moleculai-redis \
  redis:7-alpine
```

### 4. Initialize Database

```bash
# Run database migrations
psql postgresql://postgres:password@localhost:5432/moleculai < infrastructure/docker/init.sql
```

### 5. Start Services

```bash
# Terminal 1: Legacy server (optional)
npm start

# Terminal 2: API Gateway
npm run services:api-gateway

# Terminal 3: MCP Collaboration Server
npm run services:mcp

# Terminal 4: Client (if using)
npm run client:dev
```

### 6. Verify Installation

```bash
# Check API Gateway
curl http://localhost:3000/health

# Check MCP Server
curl http://localhost:4000/health
```

## Docker Deployment

### Quick Start

```bash
# Navigate to Docker directory
cd infrastructure/docker

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Custom Configuration

Edit `infrastructure/docker/docker-compose.yml` to customize:

```yaml
services:
  api-gateway:
    environment:
      - JWT_SECRET=your-production-secret
      - POSTGRES_URL=postgresql://postgres:password@postgres:5432/moleculai
```

### Build Custom Images

```bash
# Build specific service
docker build -t moleculai/api-gateway:latest services/api-gateway

# Build all services
npm run docker:build
```

### Volume Management

```bash
# View volumes
docker volume ls | grep moleculai

# Backup database
docker exec moleculai-postgres pg_dump -U postgres moleculai > backup.sql

# Restore database
docker exec -i moleculai-postgres psql -U postgres moleculai < backup.sql
```

## Kubernetes Deployment

### 1. Prerequisites

```bash
# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Configure kubectl
kubectl config current-context
```

### 2. Create Namespace

```bash
kubectl create namespace moleculai
```

### 3. Create Secrets

```bash
# Create JWT secret
kubectl create secret generic moleculai-jwt \
  --from-literal=secret=your-secure-secret \
  -n moleculai

# Create database password
kubectl create secret generic moleculai-db \
  --from-literal=password=your-db-password \
  -n moleculai
```

### 4. Install with Helm

```bash
# Install chart
helm install moleculai ./infrastructure/kubernetes \
  --namespace moleculai \
  --values production-values.yaml

# Verify deployment
kubectl get pods -n moleculai
kubectl get services -n moleculai
```

### 5. Custom Values

Create `production-values.yaml`:

```yaml
replicaCount:
  apiGateway: 3
  mcpCollaboration: 5

image:
  registry: ghcr.io
  repository: yourusername/moleculai
  tag: "1.0.0"

ingress:
  enabled: true
  hosts:
    - host: moleculai.yourdomain.com
      paths:
        - path: /
          service: api-gateway

postgresql:
  auth:
    password: YOUR_SECURE_PASSWORD

redis:
  auth:
    password: YOUR_SECURE_PASSWORD

env:
  JWT_SECRET: YOUR_JWT_SECRET
```

### 6. Upgrade Deployment

```bash
# Upgrade with new values
helm upgrade moleculai ./infrastructure/kubernetes \
  --namespace moleculai \
  --values production-values.yaml

# Rollback if needed
helm rollback moleculai -n moleculai
```

### 7. Scaling

```bash
# Manual scaling
kubectl scale deployment api-gateway --replicas=5 -n moleculai

# Horizontal Pod Autoscaling (HPA)
kubectl autoscale deployment api-gateway \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n moleculai
```

## Production Deployment

### AWS EKS

```bash
# Create EKS cluster
eksctl create cluster \
  --name moleculai-prod \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.large \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 10

# Install ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/aws/deploy.yaml

# Install cert-manager for TLS
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Deploy MOLECULAI
helm install moleculai ./infrastructure/kubernetes \
  --namespace moleculai \
  --create-namespace \
  --values aws-production-values.yaml
```

### Google GKE

```bash
# Create GKE cluster
gcloud container clusters create moleculai-prod \
  --num-nodes=3 \
  --machine-type=n1-standard-4 \
  --zone=us-central1-a \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=10

# Get credentials
gcloud container clusters get-credentials moleculai-prod --zone=us-central1-a

# Deploy
helm install moleculai ./infrastructure/kubernetes \
  --namespace moleculai \
  --create-namespace \
  --values gcp-production-values.yaml
```

### Azure AKS

```bash
# Create AKS cluster
az aks create \
  --resource-group moleculai-rg \
  --name moleculai-prod \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get credentials
az aks get-credentials \
  --resource-group moleculai-rg \
  --name moleculai-prod

# Deploy
helm install moleculai ./infrastructure/kubernetes \
  --namespace moleculai \
  --create-namespace \
  --values azure-production-values.yaml
```

## Configuration

### Environment Variables

Key configuration options:

```bash
# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24h
OAUTH_ENABLED=true

# Database
POSTGRES_URL=postgresql://user:pass@host:5432/moleculai
REDIS_URL=redis://host:6379

# Services
MCP_SERVER_URL=http://mcp-collaboration:4000
RENDERER_URL=http://renderer:5000

# Storage
STORAGE_TYPE=s3
S3_BUCKET=moleculai-assets
S3_REGION=us-east-1

# Monitoring
SENTRY_DSN=https://...
PROMETHEUS_ENABLED=true

# Features
FEATURE_COLLABORATION=true
FEATURE_SIMULATIONS=true
```

### Database Configuration

```sql
-- Create database
CREATE DATABASE moleculai;

-- Create user
CREATE USER moleculai_user WITH PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE moleculai TO moleculai_user;
```

### SSL/TLS Configuration

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: moleculai-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - moleculai.yourdomain.com
      secretName: moleculai-tls
  rules:
    - host: moleculai.yourdomain.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: api-gateway
                port:
                  number: 3000
```

## Monitoring

### Prometheus Setup

```yaml
# prometheus-config.yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'moleculai'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - moleculai
```

### Grafana Dashboards

Import dashboards:
1. Node.js Application Metrics
2. PostgreSQL Metrics
3. Redis Metrics
4. Kubernetes Cluster Metrics

### Logging

```bash
# View logs
kubectl logs -f deployment/api-gateway -n moleculai

# Stream logs to file
kubectl logs deployment/api-gateway -n moleculai --tail=1000 > api-gateway.log

# Search logs
kubectl logs deployment/api-gateway -n moleculai | grep ERROR
```

### Alerting

Set up alerts in Prometheus:

```yaml
# alerts.yaml
groups:
  - name: moleculai
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
```

## Troubleshooting

### Common Issues

**Database Connection Issues:**
```bash
# Check database is running
kubectl get pods -n moleculai | grep postgres

# Test connection
kubectl exec -it postgres-pod -n moleculai -- psql -U postgres -d moleculai

# Check logs
kubectl logs postgres-pod -n moleculai
```

**Pod Crashes:**
```bash
# Check pod status
kubectl describe pod api-gateway-xxx -n moleculai

# View crash logs
kubectl logs api-gateway-xxx -n moleculai --previous

# Check resource limits
kubectl top pods -n moleculai
```

**Ingress Issues:**
```bash
# Check ingress status
kubectl get ingress -n moleculai

# Describe ingress
kubectl describe ingress moleculai-ingress -n moleculai

# Check ingress controller logs
kubectl logs -n ingress-nginx ingress-nginx-controller-xxx
```

**Performance Issues:**
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n moleculai

# Scale up
kubectl scale deployment api-gateway --replicas=5 -n moleculai

# Check HPA status
kubectl get hpa -n moleculai
```

### Health Checks

```bash
# API Gateway
curl http://localhost:3000/health

# MCP Server
curl http://localhost:4000/health

# Prometheus Metrics
curl http://localhost:3000/metrics
```

### Backup and Restore

**Database Backup:**
```bash
# Backup
kubectl exec postgres-pod -n moleculai -- \
  pg_dump -U postgres moleculai | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup-20240101.sql.gz | \
  kubectl exec -i postgres-pod -n moleculai -- \
  psql -U postgres moleculai
```

**Redis Backup:**
```bash
# Create RDB snapshot
kubectl exec redis-pod -n moleculai -- redis-cli BGSAVE

# Copy snapshot
kubectl cp redis-pod:/data/dump.rdb ./dump.rdb -n moleculai
```

## Security Best Practices

1. **Use Secrets Management:**
   - Kubernetes Secrets
   - HashiCorp Vault
   - AWS Secrets Manager

2. **Enable Network Policies:**
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: moleculai-network-policy
   spec:
     podSelector:
       matchLabels:
         app: moleculai
     policyTypes:
       - Ingress
       - Egress
   ```

3. **Regular Updates:**
   - Update dependencies regularly
   - Patch security vulnerabilities
   - Keep Docker images updated

4. **Access Control:**
   - Use RBAC in Kubernetes
   - Implement least privilege
   - Regular security audits

## Support

For deployment assistance:
- 📧 Email: devops@moleculai.example.com
- 💬 Discord: [Join our community](https://discord.gg/moleculai)
- 📚 Docs: [Documentation](https://docs.moleculai.example.com)
