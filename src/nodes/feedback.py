from typing import Dict
from utils.parts.qa_verification import generate_feedback

from src.types import FeedbackState, AnswersState

def feedback_node(state: AnswersState) -> FeedbackState:
    print(f"--- Nodo: feedback ---")
    respuestas = state.get('respuestas_ia_verificacion', {})
    resultado = generate_feedback(respuestas)
    return {'resultado_feedback': resultado}