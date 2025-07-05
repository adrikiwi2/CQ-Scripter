from langgraph.graph import StateGraph, START, END
from src.types import WorkflowState
from src.nodes.entrada_prompt import entrada_prompt_node
from src.nodes.generar_pieza import generar_pieza_node
from src.nodes.questions import questions_node
from src.nodes.extraer_codigo import extraer_codigo_node
from src.nodes.ejecutar_codigo import ejecutar_codigo_node
from src.nodes.fotografo import fotografo_node
from src.nodes.answers import answers_node
from src.nodes.feedback import feedback_node
from src.nodes.feedforward import feedforward_node
from src.nodes.cleanup import cleanup_node
from src.nodes.reparador import reparador_node

builder = StateGraph(WorkflowState)

# Nodos principales
builder.add_node("entrada_prompt", entrada_prompt_node)

# Nodos paralelos tras entrada_prompt
builder.add_node("generar_pieza", generar_pieza_node)
builder.add_node("questions", questions_node)

# Nodos aguas abajo que reciben subestados
builder.add_node("extraer_codigo", extraer_codigo_node)
builder.add_node("ejecutar_codigo", ejecutar_codigo_node)
builder.add_node("fotografo", fotografo_node)
builder.add_node("answers", answers_node, defer=True)
builder.add_node("feedback", feedback_node)
builder.add_node("feedforward", feedforward_node)
builder.add_node("cleanup", cleanup_node)
builder.add_node("reparador", reparador_node)


# 1. Inicio
builder.add_edge(START, "entrada_prompt")

# 2. El prompt pasa por 'generar_pieza' y 'questions' en paralelo
builder.add_edge("entrada_prompt", "generar_pieza")
builder.add_edge("entrada_prompt", "questions")

# 3. 'generar_pieza' -> 'extraer_codigo'
builder.add_edge("generar_pieza", "extraer_codigo")

# 4. 'extraer_codigo' -> 'ejecutar_codigo'
builder.add_edge("extraer_codigo", "ejecutar_codigo")

# 5. 'ejecutar_codigo' bifurca según resultado

def ruta_despues_de_ejecutar_codigo(state):
    if state.get("resultado_ejecucion_step") == "ok":
        return "fotografo"
    else:
        return "reparador"

builder.add_conditional_edges(
    "ejecutar_codigo",
    ruta_despues_de_ejecutar_codigo,
    {"fotografo": "fotografo", "reparador": "reparador"}
)

# 6. 'reparador' reintenta -> 'extraer_codigo'
builder.add_edge("reparador", "extraer_codigo")

# 7. 'fotografo' -> 'answers'
builder.add_edge("fotografo", "answers")

# 8. 'questions' -> 'answers' (para que answers tenga preguntas y fotos)
builder.add_edge("questions", "answers")

# 9. 'answers' -> 'feedback'
builder.add_edge("answers", "feedback")

# Espera explícita: 'answers' solo se ejecuta cuando están presentes preguntas y fotos
#builder.defer_node_execution("answers", wait_for=["preguntas_verificacion", "imagenes_step"])  # <-- Sincronización robusta

# 10. 'feedback' bifurca según resultado

def ruta_despues_de_feedback(state):
    if state.get("resultado_feedback") == "ok":
        return END
    else:
        return "feedforward"

builder.add_conditional_edges(
    "feedback",
    ruta_despues_de_feedback,
    {END: END, "feedforward": "feedforward"}
)

# 11. 'feedforward' -> 'extraer_codigo' (ciclo)
builder.add_edge("feedforward", "extraer_codigo")

# 12. Ejemplo de input inicial esperado:
# {
#     "nombre_pieza": "cubo_con_agujero",  # Nombre único de la pieza
#     "prompt_entrada": "Genera un cubo de 10x10x10 con un agujero cilíndrico..."
# }
# Compila el grafo
graph = builder.compile()
