#!/bin/bash

# Noe Sushi Operations API Deployment Script
# This script helps deploy and manage the production backend

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PORT=${PORT:-5000}
NODE_ENV=${NODE_ENV:-production}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2)
    if [[ $(echo "$NODE_VERSION 16.0.0" | tr ' ' '\n' | sort -V | head -n1) != "16.0.0" ]]; then
        print_error "Node.js version 16.0.0 or higher is required. Current: $NODE_VERSION"
        exit 1
    fi

    print_success "Dependencies check passed"
}

check_environment() {
    print_status "Checking environment configuration..."

    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Please edit .env file with your Odoo credentials"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    fi

    # Check if required variables are set
    source .env

    if [ -z "$ODOO_URL" ] || [ -z "$ODOO_DB" ] || [ -z "$ODOO_USER" ] || [ -z "$ODOO_PASSWORD" ]; then
        print_error "Missing required environment variables in .env file"
        print_error "Required: ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD"
        exit 1
    fi

    print_success "Environment configuration check passed"
}

install_dependencies() {
    print_status "Installing dependencies..."
    npm ci --only=production
    print_success "Dependencies installed"
}

health_check() {
    print_status "Performing health check..."

    # Wait for server to start
    sleep 3

    if curl -f -s "http://localhost:$PORT/health" > /dev/null; then
        print_success "Health check passed - API is running"
        curl -s "http://localhost:$PORT/health" | grep -o '"status":"[^"]*"'
    else
        print_error "Health check failed - API is not responding"
        return 1
    fi
}

test_authentication() {
    print_status "Testing authentication..."

    RESPONSE=$(curl -s -X POST "http://localhost:$PORT/api/auth")

    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Authentication test passed"
        echo "$RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4
    else
        print_error "Authentication test failed"
        echo "Response: $RESPONSE"
        return 1
    fi
}

start_server() {
    print_status "Starting Noe Sushi Operations API..."

    if [ "$NODE_ENV" = "production" ]; then
        npm run prod &
    else
        npm start &
    fi

    SERVER_PID=$!
    echo $SERVER_PID > server.pid

    print_success "Server started with PID: $SERVER_PID"
    print_status "API available at: http://localhost:$PORT"
    print_status "Health check: http://localhost:$PORT/health"
    print_status "API docs: http://localhost:$PORT/api"
}

stop_server() {
    print_status "Stopping server..."

    if [ -f "server.pid" ]; then
        PID=$(cat server.pid)
        if ps -p $PID > /dev/null; then
            kill $PID
            print_success "Server stopped (PID: $PID)"
            rm server.pid
        else
            print_warning "Server process not found"
            rm server.pid
        fi
    else
        print_warning "No server.pid file found"
    fi
}

deploy() {
    print_status "=== Noe Sushi Operations API Deployment ==="

    check_dependencies
    check_environment
    install_dependencies
    start_server

    # Wait for server to start and run checks
    health_check
    test_authentication

    print_success "=== Deployment completed successfully! ==="
    print_status "Server is running at http://localhost:$PORT"
}

show_help() {
    cat << EOF
Noe Sushi Operations API Deployment Script

Usage: $0 [OPTION]

Options:
  deploy      Full deployment (default)
  start       Start the server
  stop        Stop the server
  restart     Restart the server
  health      Run health check
  test        Test authentication
  logs        Show server logs
  status      Show server status
  help        Show this help message

Environment Variables:
  PORT        Server port (default: 5000)
  NODE_ENV    Environment (default: production)

Examples:
  $0 deploy
  PORT=3000 $0 start
  NODE_ENV=development $0 deploy

EOF
}

show_status() {
    print_status "=== Server Status ==="

    if [ -f "server.pid" ]; then
        PID=$(cat server.pid)
        if ps -p $PID > /dev/null; then
            print_success "Server is running (PID: $PID)"
            print_status "Port: $PORT"
            print_status "Environment: $NODE_ENV"
            print_status "Uptime: $(ps -o etime= -p $PID | tr -d ' ')"
        else
            print_warning "Server PID file exists but process not found"
            rm server.pid
        fi
    else
        print_warning "Server is not running"
    fi
}

# Main script logic
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 2
        start_server
        ;;
    health)
        health_check
        ;;
    test)
        test_authentication
        ;;
    status)
        show_status
        ;;
    logs)
        if [ -f "server.pid" ]; then
            tail -f nohup.out 2>/dev/null || print_warning "No log file found"
        else
            print_warning "Server is not running"
        fi
        ;;
    help)
        show_help
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac