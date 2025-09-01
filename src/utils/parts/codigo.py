import re
import os # Necesario para os.path y para el código que se inyectará
import importlib.util
import traceback
from openai import OpenAI
# Patrón para extraer contenido de bloques de código delimitados por ```
# ADVERTENCIA: Este patrón BACKTICK_PATTERN tal como está (r"(?:^|\n)``````
# correctamente para extraer bloques de código Markdown. Debería ser algo como r"```(.*?)```
# o r"(?:^|\n)```(?:[a-zA-Z]+\n)?(.*?)```
# Se utiliza el patrón exacto que proporcionaste.
BACKTICK_PATTERN = r"(?:^|\n)```(?:[a-zA-Z]+\n)?(.*?)```"

def extract_code_from_response(content: str, nombre_pieza: str) -> str:
    """
    Extrae bloques de código, modifica las llamadas a cq.exporters.export para archivos .step
    para que guarden en el subdirectorio 'parts/', y añade código para crear dicho directorio.
    """
    if not nombre_pieza or nombre_pieza == "None":
        raise ValueError("[extract_code_from_response] nombre_pieza no puede ser None ni vacío")
    # 1. Extraer todos los contenidos de los bloques de código
    code_content_list = re.findall(BACKTICK_PATTERN, content, re.DOTALL)

    if not code_content_list:
        # Si el patrón BACKTICK_PATTERN no encuentra nada, pero hay código,
        # podría ser útil devolver el contenido original como un fallback,
        # o asegurarse de que el LLM SIEMPRE use los backticks.
        # Por ahora, si no hay backticks según el patrón, no se extrae nada.
        return ""

    processed_blocks = []
    any_export_modified_to_parts = False

    for raw_block_content in code_content_list:
        block = raw_block_content.strip()
        lines = block.split("\n")
        if lines and lines[0].strip() and \
           (not lines[0].strip() or " " not in lines[0].strip().lower()): # Comprobación más robusta de la primera línea
            if lines[0].strip().isalpha() or not lines[0].strip(): # Si es puramente alfabético (identificador de idioma) o vacío
                block = "\n".join(lines[1:])
        
        block = block.strip()
        
        def modify_export_path(match_obj):
            nonlocal any_export_modified_to_parts
            part_before_filename = match_obj.group(1)
            original_filename_with_path = match_obj.group(2)
            part_after_filename = match_obj.group(3)
            clean_basename = os.path.basename(original_filename_with_path)
            new_filepath_in_code = f"parts/{nombre_pieza}/{clean_basename}"
            any_export_modified_to_parts = True
            return f"{part_before_filename}{new_filepath_in_code}{part_after_filename}"

        # Nuevo patrón regex para capturar correctamente la exportación de archivos .step
        export_pattern = r"(cq\.exporters\.export\([^,]+,\s*['\"])([^'\"]+\.step)(['\"])"

        modified_block = re.sub(export_pattern, modify_export_path, block, flags=re.IGNORECASE)
        processed_blocks.append(modified_block)

    combined_code = "\n\n".join(processed_blocks)

    if any_export_modified_to_parts:
        create_dir_code_lines = []
        if not re.search(r"^\s*import\s+os\b", combined_code, re.MULTILINE):
            create_dir_code_lines.append("import os")
        # Corrección sintáctica aquí: usar comillas dobles externas para la cadena
        create_dir_code_lines.append("os.makedirs('parts', exist_ok=True)")
        setup_code = "\n".join(create_dir_code_lines)
        if combined_code:
            combined_code = setup_code + "\n\n" + combined_code
        else:
            combined_code = setup_code

    return combined_code.strip()


def save_llm_code_to_file(code_str: str, nombre_pieza: str) -> str:
    """Guarda el código generado por el LLM en parts/nombre_pieza/nombre_pieza.py y retorna la ruta."""
    import os
    if not nombre_pieza or nombre_pieza == "None":
        raise ValueError("[save_llm_code_to_file] nombre_pieza no puede ser None ni vacío")
    dir_path = os.path.join("parts", nombre_pieza)
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{nombre_pieza}.py")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(code_str)
    return file_path

def execute_cadquery_script(nombre_pieza: str, nombre_archivo_step: str = None) -> dict:
    """
    Ejecuta el archivo .py generado para la pieza y verifica el .step en la ruta correcta.
    Devuelve un dict con 'ok', 'error' y la ruta al archivo .step si se generó correctamente.
    """
    import os
    import glob
    import importlib.util
    import traceback
    if not nombre_pieza or nombre_pieza == "None":
        return {"ok": False, "error": "[execute_cadquery_script] nombre_pieza no puede ser None ni vacío", "step_path": None}
    
    dir_path = os.path.join("parts", nombre_pieza)
    py_file_path = os.path.join(dir_path, f"{nombre_pieza}.py")
    result = {"ok": False, "error": None, "step_path": None}
    
    try:
        spec = importlib.util.spec_from_file_location("llm_cad_module", py_file_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Busca cualquier archivo .step en el directorio de la pieza
        step_files = glob.glob(os.path.join(dir_path, "*.step"))
        if step_files:
            # Toma el primer archivo .step encontrado
            result["ok"] = True
            result["step_path"] = step_files[0]
        else:
            result["error"] = f"No se encontró ningún archivo STEP en {dir_path}"
    except Exception as e:
        result["error"] = traceback.format_exc()
    return result


def repair_cadquery_code(code_with_error: str, error_message: str, max_attempts: int = 3, temperature: float = 0.2) -> str:
    """
    Utiliza GPT para reparar código CadQuery que ha fallado, guiado por el mensaje de error.
    
    Parámetros:
      - code_with_error: El código fuente original que ha fallado.
      - error_message: El mensaje de error capturado en la ejecución.
      - max_attempts: Número máximo de intentos de reparación (por si lo llamas en bucle).
      - temperature: Creatividad de la respuesta del modelo.
      
    Retorna:
      - Código reparado como string.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY no está configurada en el entorno.")

    client = OpenAI(api_key=api_key)

    system_prompt = (
        "Eres un asistente experto en Python y CadQuery. "
        "Te proporcionaré código que genera modelos 3D con CadQuery y un mensaje de error que se produjo al ejecutarlo. "
        "Tu tarea es corregir solo el error detectado, explicando el motivo en un comentario dentro del código (al principio o junto a la corrección). "
        "No modifiques otras partes del código que no estén relacionadas con el error. "
        "Devuelve solo el código Python corregido y funcional, sin texto adicional ni explicaciones fuera del bloque de código."
    )

    user_prompt = (
        "Código original:\n"
        "----------------------\n"
        f"{code_with_error}\n"
        "----------------------\n"
        f"Mensaje de error:\n{error_message}\n\n"
        "Por favor, corrige únicamente la causa de este error."
    )

    # Llamada al modelo
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=temperature,
        max_tokens=1500
    )
    # Asumimos que devuelve solo el bloque de código limpio
    fixed_code = response.choices[0].message.content
    return fixed_code.strip()
