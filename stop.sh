#!/bin/bash
# Simple stop script

echo "Stopping services..."

# Stop backend (by process name)
pkill -f "start_server.py" 2>/dev/null
pkill -f "uvicorn.*main:app" 2>/dev/null

# Stop frontend (by process name)
pkill -f "vite" 2>/dev/null

# Or stop by port
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

sleep 1
echo "Services stopped."
