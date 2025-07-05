from typing import Dict, Any
from src.types import WorkflowState

def entrada_prompt_node(state: WorkflowState) -> Dict[str, Any]:
    print(f"--- Nodo: entrada_prompt ---")
    out = {}
    if not state.get('prompt_entrada'):
        print("    Estableciendo prompt de entrada de ejemplo.")
        out["prompt_entrada"] = "Genera un cubo de 10x10x10 con un agujero cilíndrico de radio 2 en el centro."
    if not state.get('nombre_pieza'):
        print("    Estableciendo nombre de pieza de ejemplo.")
        out["nombre_pieza"] = "cubo_con_agujero"
    return out
