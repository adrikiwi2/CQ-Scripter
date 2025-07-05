from typing import Optional, List, Dict, Literal
from typing_extensions import TypedDict

# Estado global compartido (público)
class WorkflowState(TypedDict, total=False):
    nombre_pieza: str  # Nombre único de la pieza, definido en el input inicial
    prompt_entrada: Optional[str]
    # Puedes añadir aquí otros campos realmente globales si los necesitas

# Subestados privados para cada nodo paralelo o rama
class GenerarPiezaState(WorkflowState):
    raw_llm_output: str

class QuestionsState(WorkflowState):
    preguntas_verificacion: List[str]

class ExtraerCodigoState(WorkflowState):
    codigo_extraido: str

class EjecutarCodigoState(WorkflowState):
    resultado_ejecucion_step: Literal["ok", "error :("]
    error_ejecucion: Optional[str]
    step_path: Optional[str]

class FotografoState(WorkflowState):
    imagenes_step: List[str]

class AnswersState(WorkflowState):
    respuestas_ia_verificacion: Dict

class FeedbackState(WorkflowState):
    resultado_feedback: Literal["ok", "otro"]
