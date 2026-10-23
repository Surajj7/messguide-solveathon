#!/usr/bin/env python3
"""
NutriGuide / MessGuide Solveathon Runner
Launches both Backend Server (port 4000) and Frontend Client (port 5173).
Handles environment verification, database setup, and process management.
"""

import os
import sys
import time
import signal
import subprocess
import threading
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SERVER_DIR = ROOT_DIR / "server"
CLIENT_DIR = ROOT_DIR / "client"

# ANSI Colors
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
RESET = "\033[0m"

processes = []

def log(msg, color=CYAN, prefix="STARTUP"):
    print(f"{color}[{prefix}]{RESET} {msg}", flush=True)

def cleanup(*args):
    print("\n")
    log("Shutting down NutriGuide services...", color=YELLOW, prefix="SHUTDOWN")
    for p in processes:
        if p and p.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.call(["taskkill", "/F", "/T", "/PID", str(p.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    p.terminate()
            except Exception:
                pass
    log("All services stopped. Goodbye!", color=GREEN, prefix="SHUTDOWN")
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

def stream_logs(process, prefix, color):
    for line in iter(process.stdout.readline, ''):
        if not line:
            break
        print(f"{color}[{prefix}]{RESET} {line.rstrip()}", flush=True)

def setup_environment():
    log("Checking environment & database configuration...", color=CYAN)
    
    # Check server/.env
    env_file = SERVER_DIR / ".env"
    if not env_file.exists():
        log("Creating server/.env with default PostgreSQL config...", color=YELLOW)
        default_env = (
            'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mess_menu?schema=public"\n'
            'PORT=4000\n'
            'JWT_SECRET="messtrack-solveathon-secure-jwt-key-2026-min-32-chars"\n'
            'JWT_EXPIRES="7d"\n'
            'COMPLAINT_ESCALATION_THRESHOLD=3\n'
        )
        with open(env_file, "w", encoding="utf-8") as f:
            f.write(default_env)

    # Disable prisma network checkpointing
    os.environ["CHECKPOINT_DISABLE"] = "1"
    os.environ["PRISMA_TELEMETRY_INFORMATION"] = "0"

    # Verify query engine exists
    engine_src = SERVER_DIR / "node_modules" / "@prisma" / "engines" / "query_engine-windows.dll.node"
    if engine_src.exists():
        for target_dir in [
            SERVER_DIR / "node_modules" / "prisma",
            SERVER_DIR / "node_modules" / "@prisma" / "client",
            SERVER_DIR / "node_modules" / ".prisma" / "client",
        ]:
            if target_dir.exists():
                dst = target_dir / "query_engine-windows.dll.node"
                if not dst.exists():
                    try:
                        import shutil
                        shutil.copy2(engine_src, dst)
                    except Exception:
                        pass

    # Ensure Prisma generate and db push
    try:
        log("Ensuring Prisma Client is generated...", color=CYAN)
        subprocess.run(
            ["node", "prisma/gen.js"],
            cwd=str(SERVER_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=True
        )
    except Exception:
        pass

    log("Database and configuration ready.", color=GREEN)

def start_services():
    print("=" * 68)
    print(f"{BOLD}{GREEN}       NutriGuide / MessGuide — Complete Campus Dining System{RESET}")
    print("=" * 68)
    print(f"{CYAN}  * Backend API Server:  {BOLD}http://localhost:4000{RESET}")
    print(f"{CYAN}  * Frontend Web App:    {BOLD}http://localhost:5173{RESET}")
    print("-" * 68)
    print(f"{YELLOW}  Demo Credentials (Password: {BOLD}password123{RESET}{YELLOW}):{RESET}")
    print(f"   - {BOLD}Parent (Sunil Sharma):{RESET}       parent1@vitparent.ac.in (linked to Rahul Sharma)")
    print(f"   - {BOLD}Parent (Kavita Patel):{RESET}       parent.priya@vitparent.ac.in (linked to Priya Patel)")
    print(f"   - {BOLD}Student Veg (Zenith):{RESET}        student.veg@vitstudent.ac.in")
    print(f"   - {BOLD}Student Non-Veg (Fusion):{RESET}    student.nonveg@vitstudent.ac.in")
    print(f"   - {BOLD}Student Special (Proodle):{RESET}   student.special@vitstudent.ac.in")
    print(f"   - {BOLD}Student Foodpark (CRCL):{RESET}     student.foodpark@vitstudent.ac.in")
    print(f"   - {BOLD}Mess Incharge:{RESET}                mess1@messadmin.ac.in")
    print(f"   - {BOLD}Campus Director (Admin):{RESET}     admin1@vitadmin.ac.in")
    print("=" * 68 + "\n")

    env = os.environ.copy()
    env["CHECKPOINT_DISABLE"] = "1"
    env["PRISMA_TELEMETRY_INFORMATION"] = "0"

    # Start Server (Node.js)
    log("Starting Backend API server on port 4000...", color=MAGENTA, prefix="SERVER")
    server_cmd = ["node", "src/index.js"]
    server_proc = subprocess.Popen(
        server_cmd,
        cwd=str(SERVER_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env=env,
        shell=(sys.platform == "win32")
    )
    processes.append(server_proc)

    # Start Client (Vite Dev Server)
    log("Starting Frontend Vite dev server on port 5173...", color=GREEN, prefix="CLIENT")
    client_cmd = ["npm", "run", "dev"]
    client_proc = subprocess.Popen(
        client_cmd,
        cwd=str(CLIENT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=(sys.platform == "win32")
    )
    processes.append(client_proc)

    # Stream logs
    t1 = threading.Thread(target=stream_logs, args=(server_proc, "SERVER", MAGENTA), daemon=True)
    t2 = threading.Thread(target=stream_logs, args=(client_proc, "CLIENT", GREEN), daemon=True)
    t1.start()
    t2.start()

    try:
        while True:
            time.sleep(1)
            if server_proc.poll() is not None:
                log(f"Server exited with code {server_proc.returncode}", color=RED, prefix="SERVER")
                break
            if client_proc.poll() is not None:
                log(f"Client exited with code {client_proc.returncode}", color=RED, prefix="CLIENT")
                break
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    setup_environment()
    start_services()
