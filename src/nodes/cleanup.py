import os
from typing import Dict

def cleanup_node(state) -> Dict:
    print(f"--- Nodo: cleanup ---")
    # Limpieza de archivos temporales generados durante el flujo
    temp_files = ["tmp/llm_code.py"]
    for f in temp_files:
        try:
            if os.path.exists(f):
                os.remove(f)
                print(f"Archivo temporal eliminado: {f}")
        except Exception as e:
            print(f"Error al eliminar {f}: {e}")
    return state
