import os
import base64
from openai import OpenAI
import glob

def test_answer_with_images(image_dir, questions):
    """
    Prueba la funcionalidad de respuesta a preguntas utilizando imágenes existentes.
    
    Args:
        image_dir: Directorio donde se encuentran las imágenes (ej: 'parts/cubo_con_agujero/')
        questions: Lista de preguntas para verificar
    
    Returns:
        La respuesta del modelo
    """
    # Asegurarse que el directorio termina con /
    if not image_dir.endswith('/'):
        image_dir += '/'
    
    # Buscar todas las imágenes PNG en el directorio
    image_paths = glob.glob(f"{image_dir}*_view_*.png")
    
    if not image_paths:
        return "No se encontraron imágenes en el directorio especificado."
    
    # Ordenar las imágenes por nombre para asegurar el orden correcto
    image_paths.sort()
    
    print(f"Imágenes encontradas: {len(image_paths)}")
    for img in image_paths:
        print(f"  - {img}")
    
    # Inicializar el cliente de OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    # Prompt del sistema
    system_prompt = (
        "Your job is to answer this set of questions with respect to the object I have shared with you. \n"
        f"I will be providing {len(image_paths)} images of the object from different orientations so that you can get a complete picture of the 3D object. "
        "Here are some important points regarding your task:\n"
        "(1) Remember that these images are all of the same object from different angles.\n"
        "(2) The answer to each of these questions should always be one of three options: \"Yes\", \"No\" or \"Unclear.\"\n"
        "(3) Your answer should be \"Unclear\" in situations where you are unsure or do not have enough information to answer.\n"
        "Make sure to provide reasoning supporting all your answers.\n"
        "#Your answer should follow the same format as below:\n"
        "1. **Question?**\n"
        "   - **Answer:**\n"
        "   - **Reasoning:**\n\n"
        "2. **Question?**\n"
        "   - **Answer:**\n"
        "   - **Reasoning:**"
    )
    
    # Preparamos el contenido del mensaje del usuario
    user_content = [{"type": "text", "text": f"Verification Questions:\n{questions}"}]
    
    # Etiquetas que describen cada perspectiva isométrica
    perspective_labels = [
        "Perspective: Isometric view at 0° (object seen from an inclined angle due to a rotation of ~35° in X and ~45° in Z).",
        "Perspective: Isometric view at 120° (object seen from the same inclined angle, rotated 120° around the Z axis).",
        "Perspective: Isometric view at 240° (object seen from the same inclined angle, rotated 240° around the Z axis)."
    ]
    
    # Ajustar las etiquetas si hay más o menos imágenes que etiquetas
    if len(image_paths) < len(perspective_labels):
        perspective_labels = perspective_labels[:len(image_paths)]
    elif len(image_paths) > len(perspective_labels):
        # Añadir etiquetas genéricas para las imágenes adicionales
        for i in range(len(perspective_labels), len(image_paths)):
            perspective_labels.append(f"Perspective: Additional view {i+1}.")
    
    # Para cada imagen, añadimos la etiqueta y la imagen
    for path, label in zip(image_paths, perspective_labels):
        user_content.append({"type": "text", "text": label})
        
        try:
            with open(path, "rb") as img_file:
                img_bytes = img_file.read()
            b64_img = base64.b64encode(img_bytes).decode("utf-8")
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{b64_img}",
                    "detail": "high"
                }
            })
            print(f"Imagen cargada: {path}")
        except Exception as e:
            print(f"Error al cargar la imagen {path}: {e}")
            return f"Error al cargar la imagen {path}: {e}"
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]
    
    try:
        print("Enviando solicitud a OpenAI...")
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.0
        )
        print("Respuesta recibida de OpenAI")
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error al llamar a la API de OpenAI: {e}")
        return f"Error al llamar a la API de OpenAI: {e}"

# Ejemplo de uso
if __name__ == "__main__":
    # Directorio donde están las imágenes
    image_dir = "parts/cubo_con_agujero/"
    
    # Preguntas de ejemplo (puedes modificarlas según tus necesidades)
    questions = """
    1. ¿Es el objeto un cubo?
    2. ¿Tiene el objeto un agujero cilíndrico?
    3. ¿Atraviesa el agujero el cubo completamente?
    """
    
    # Ejecutar la prueba
    result = test_answer_with_images(image_dir, questions)
    
    # Imprimir el resultado
    print("\n--- RESULTADO ---\n")
    print(result)
