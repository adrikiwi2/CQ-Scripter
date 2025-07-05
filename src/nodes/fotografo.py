import os
from typing import Dict
from src.utils.parts.fotos import generate_cad_images_from_step

from src.types import FotografoState, EjecutarCodigoState

def fotografo_node(state: EjecutarCodigoState) -> FotografoState:
    print(f"--- Nodo: fotografo ---")
    step_path = state.get('step_path')
    nombre_pieza = state.get('nombre_pieza')
    output_dir = f"parts/{nombre_pieza}/"
    if step_path and os.path.exists(step_path):
        image_paths = generate_cad_images_from_step(step_path, output_dir)
        return {'imagenes_step': image_paths}
    else:
        return {'imagenes_step': []}
