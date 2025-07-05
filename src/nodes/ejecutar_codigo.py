from utils.parts.codigo import save_llm_code_to_file, execute_cadquery_script

from src.types import EjecutarCodigoState, ExtraerCodigoState

def ejecutar_codigo_node(state: ExtraerCodigoState) -> EjecutarCodigoState:
    print(f"--- Nodo: ejecutar_codigo ---")
    codigo = state.get('codigo_extraido', '')
    nombre_pieza = state.get('nombre_pieza')
    if not codigo:
        return {
            'resultado_ejecucion_step': "error :(",
            'error_ejecucion': "No se encontró código para ejecutar.",
            'step_path': None,
            'nombre_pieza': nombre_pieza
        }

    # Guardar el .py en la ruta correcta
    py_file_path = save_llm_code_to_file(codigo, nombre_pieza)
    # Ejecutar y buscar el .step en la ruta correcta
    result = execute_cadquery_script(nombre_pieza)
    if result["ok"]:
        return {
            'resultado_ejecucion_step': "ok",
            'error_ejecucion': None,
            'step_path': result["step_path"],
            'nombre_pieza': nombre_pieza
        }
    else:
        return {
            'resultado_ejecucion_step': "error :(",
            'error_ejecucion': result["error"],
            'step_path': None,
            'nombre_pieza': nombre_pieza
        }
