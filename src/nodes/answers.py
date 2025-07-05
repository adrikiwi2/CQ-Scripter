from typing import Dict
from src.utils.parts.qa_verification import answer_verification_questions

from src.types import AnswersState, FotografoState, QuestionsState

def answers_node(state: dict) -> AnswersState:
    """
    Espera:
        state['questions']['preguntas_verificacion']: List[str]
        state['fotografo']['imagenes_step']: List[str]
    """
    print(f"--- Nodo: answers ---")
    preguntas = state.get('questions', {}).get('preguntas_verificacion', [])
    imagenes = state.get('fotografo', {}).get('imagenes_step', [])

    if isinstance(preguntas, list):
        preguntas_str = "\n".join(str(q) for q in preguntas)
    else:
        preguntas_str = str(preguntas)

    respuestas = answer_verification_questions(imagenes, preguntas_str)
    return {'respuestas_ia_verificacion': respuestas}
