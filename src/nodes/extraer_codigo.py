from utils.parts.codigo import extract_code_from_response
from src.types import ExtraerCodigoState, GenerarPiezaState

def extraer_codigo_node(state: GenerarPiezaState) -> ExtraerCodigoState:
    print(f"--- Nodo: extraer_codigo ---")
    raw_response = state.get('raw_llm_output', '')
    nombre_pieza = state.get('nombre_pieza')
    if isinstance(raw_response, list):
        raw_response = "\n".join(str(x) for x in raw_response)
    if raw_response is None:
        raw_response = ''
    clean_code = extract_code_from_response(raw_response, nombre_pieza)
    return {'codigo_extraido': clean_code}
