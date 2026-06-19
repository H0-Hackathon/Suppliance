"""
Frees up a local TCP port before the dev server starts.

On Windows, a dead uvicorn parent can leave multiprocessing child workers alive
that hold the inherited socket — netstat shows the zombie parent PID, but the
actual live holder is the child. We handle both cases:
  1. Kill the PID that netstat reports as owning the port (may already be dead).
  2. Kill any Python --multiprocessing-fork workers that were orphaned by it.
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
    import wmi  # available via pywin32 / wmi package if present

    # ── Step 1: find the PID netstat reports as owning the port ──────────────
    netstat_out = subprocess.run(
        ["netstat", "-ano"], capture_output=True, text=True, check=False
    ).stdout

    owner_pids: set[str] = set()
    for line in netstat_out.splitlines():
        parts = line.split()
        if len(parts) < 5 or parts[0] != "TCP":
            continue
        local_addr, pid = parts[1], parts[-1]
        if local_addr.rsplit(":", 1)[-1] == str(port) and pid.isdigit() and pid != "0":
            owner_pids.add(pid)

    for pid in owner_pids:
        print(f"[free_port] Port {port} owned by PID {pid} — attempting kill")
        subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True, check=False)

    # ── Step 2: kill any Python multiprocessing workers spawned by those PIDs ─
    # When the parent crashes, workers hold the inherited socket but aren't
    # listed under the port in netstat. Find them via WMI by parent PID.
    if owner_pids:
        try:
            c = wmi.WMI()
            for owner_pid in owner_pids:
                children = c.Win32_Process(ParentProcessId=int(owner_pid))
                for child in children:
                    if "multiprocessing" in (child.CommandLine or "").lower():
                        print(f"[free_port] Killing orphaned worker PID {child.ProcessId}")
                        subprocess.run(
                            ["taskkill", "/F", "/PID", str(child.ProcessId)],
                            capture_output=True, check=False,
                        )
        except Exception:
            # wmi not available — fall back to killing any Python multiprocessing-fork process
            _kill_multiprocessing_orphans_windows()


def _kill_multiprocessing_orphans_windows() -> None:
    """Fallback: kill any python process with --multiprocessing-fork in its args."""
    try:
        out = subprocess.run(
            ["wmic", "process", "where",
             "name='python.exe' or name='python3.exe'",
             "get", "ProcessId,CommandLine", "/format:csv"],
            capture_output=True, text=True, check=False,
        ).stdout
        for line in out.splitlines():
            if "--multiprocessing-fork" in line:
                parts = line.strip().split(",")
                # CSV columns: Node, CommandLine, ProcessId
                pid = parts[-1].strip()
                if pid.isdigit():
                    print(f"[free_port] Killing multiprocessing-fork worker PID {pid}")
                    subprocess.run(
                        ["taskkill", "/F", "/PID", pid], capture_output=True, check=False
                    )
    except Exception as exc:
        print(f"[free_port] Orphan cleanup failed: {exc}")


def _free_port_unix(port: int) -> None:
    result = subprocess.run(
        ["lsof", "-ti", f":{port}"], capture_output=True, text=True, check=False
    )
    pids = [p for p in result.stdout.split() if p]
    for pid in pids:
        print(f"[free_port] Port {port} in use by PID {pid} -- killing it")
        subprocess.run(["kill", "-9", pid], capture_output=True, check=False)
