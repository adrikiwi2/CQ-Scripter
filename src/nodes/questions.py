from utils.parts.qa_verification import generate_verification_questions

from src.types import QuestionsState, WorkflowState

def questions_node(state: WorkflowState) -> QuestionsState:
    print(f"--- Nodo: questions ---")
    prompt = state.get('prompt_entrada', '')
    questions = generate_verification_questions(prompt)
    return {'preguntas_verificacion': questions}
