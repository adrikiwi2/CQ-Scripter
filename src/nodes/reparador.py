from typing import Dict
from src.utils.parts.codigo import repair_cadquery_code

from src.types import EjecutarCodigoState, GenerarPiezaState

def reparador_node(state: EjecutarCodigoState) -> GenerarPiezaState:
    print(f"--- Nodo: reparador ---")
    codigo_fallido = state.get('codigo_extraido', '')
    mensaje_error = state.get('error_ejecucion', '')
    if not codigo_fallido or not mensaje_error:
        print("No hay código ni error para reparar. Ciclo sin cambios.")
        return state
    print("Llamando a LLM para intentar reparar el código CadQuery...")
    try:
        codigo_reparado = repair_cadquery_code(codigo_fallido, mensaje_error)
        return {'raw_llm_output': codigo_reparado}
    except Exception as e:
        print(f"Error durante la reparación automática: {e}")
        return {'raw_llm_output': f"Error en reparación automática: {str(e)}"}
