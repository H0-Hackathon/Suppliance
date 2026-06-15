"""
Frees up a local TCP port by killing whatever process is currently bound to
it. Used at startup so re-running the dev server doesn't fail with
"port already in use" after a previous instance was left running.
"""

import platform
import subprocess


def free_port(port: int) -> None:
    try:
        if platform.system() == "Windows":
            _free_port_windows(port)
        else:
            _free_port_unix(port)
    except Exception as exc:
        print(f"[free_port] Could not check/free port {port}: {exc}")


def _free_port_windows(port: int) -> None:
    output = subprocess.run(
        ["netstat", "-ano"], capture_output=True, text=True, check=False
    ).stdout

    pids = set()
    for line in output.splitlines():
        parts = line.split()
        if len(parts) < 5 or parts[0] != "TCP":
            continue
        local_addr, pid = parts[1], parts[-1]
        if local_addr.rsplit(":", 1)[-1] == str(port) and pid.isdigit() and pid != "0":
            pids.add(pid)

    for pid in pids:
        print(f"[free_port] Port {port} in use by PID {pid} -- killing it")
        subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True, check=False)


def _free_port_unix(port: int) -> None:
    result = subprocess.run(
        ["lsof", "-ti", f":{port}"], capture_output=True, text=True, check=False
    )
    pids = [p for p in result.stdout.split() if p]
    for pid in pids:
        print(f"[free_port] Port {port} in use by PID {pid} -- killing it")
        subprocess.run(["kill", "-9", pid], capture_output=True, check=False)
