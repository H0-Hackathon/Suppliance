#!/usr/bin/env python
"""
CoastGuard backend startup script.
"""
import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

if __name__ == "__main__":
    from core.free_port import free_port
    free_port(8000)

    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )

