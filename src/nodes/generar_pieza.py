import os
from openai import OpenAI
from src.types import GenerarPiezaState, WorkflowState

def generar_pieza_node(state: WorkflowState) -> GenerarPiezaState:
    print(f"--- Nodo: generar_pieza ---")
    prompt = state.get('prompt_entrada')
    if not prompt:
        state['raw_llm_output'] = None
        print("No se proporcionó prompt de entrada.")
        return state

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY no configurada en entorno.")
        state['raw_llm_output'] = None
        return state

    client = OpenAI(api_key=api_key)

    system_prompt = (
        "Eres un asistente experto en diseño mecánico y modelado 3D con CadQuery. "
        "Cuando recibas una descripción en lenguaje natural de una pieza, "
        "responde con un solo bloque de código Python que utilice CadQuery para generar la pieza, "
        "y añade una línea que exporte el modelo a formato .step con un nombre claro. "
        "No incluyas explicaciones ni texto fuera del bloque de código. "
        "Ejemplo:\n"
        "```python\n"
        "import cadquery as cq\n"
        "# ...código...\n"
        "cq.exporters.export(pieza_final, 'mi_pieza.step')\n"
        "```"
    )

    user_prompt = prompt

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=900
        )
        raw_llm_output = response.choices[0].message.content
        state['raw_llm_output'] = raw_llm_output
        print("Código generado por LLM:")
        print(raw_llm_output)
    except Exception as e:
        print(f"Error al generar código con LLM: {e}")
        state['raw_llm_output'] = None

    return state
