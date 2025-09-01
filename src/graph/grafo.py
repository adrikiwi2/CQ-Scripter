from langgraph.graph import StateGraph, START, END
from src.types import WorkflowState
from src.nodes.entrada_prompt import entrada_prompt_node
from src.nodes.generar_pieza import generar_pieza_node
from src.nodes.extraer_codigo import extraer_codigo_node
from src.nodes.ejecutar_codigo import ejecutar_codigo_node
from src.nodes.fotografo import fotografo_node
from src.nodes.cleanup import cleanup_node
from src.nodes.reparador import reparador_node

builder = StateGraph(WorkflowState)

# Nodos del workflow simplificado
builder.add_node("entrada_prompt", entrada_prompt_node)
builder.add_node("generar_pieza", generar_pieza_node)
builder.add_node("extraer_codigo", extraer_codigo_node)
builder.add_node("ejecutar_codigo", ejecutar_codigo_node)
builder.add_node("fotografo", fotografo_node)
builder.add_node("cleanup", cleanup_node)
builder.add_node("reparador", reparador_node)

# Flujo lineal simplificado
builder.add_edge(START, "entrada_prompt")
builder.add_edge("entrada_prompt", "generar_pieza")
builder.add_edge("generar_pieza", "extraer_codigo")
builder.add_edge("extraer_codigo", "ejecutar_codigo")

# Manejo de errores con retry del LLM
def ruta_despues_de_ejecutar_codigo(state):
    if state.get("resultado_ejecucion_step") == "ok":
        return "fotografo"
    else:
        # En caso de error, intenta reparar con el LLM
        return "reparador"

builder.add_conditional_edges(
    "ejecutar_codigo",
    ruta_despues_de_ejecutar_codigo,
    {"fotografo": "fotografo", "reparador": "reparador"}
)

# El reparador reintenta generando código corregido
builder.add_edge("reparador", "extraer_codigo")

# Flujo exitoso: fotografiar y limpiar
builder.add_edge("fotografo", "cleanup")
builder.add_edge("cleanup", END)

# Ejemplo de input inicial esperado:
# {
#     "nombre_pieza": "cubo_con_agujero",  # Nombre único de la pieza
#     "prompt_entrada": "Genera un cubo de 10x10x10 con un agujero cilíndrico..."
# }

# Compila el grafo
graph = builder.compile()
