import os
from OCC.Display.SimpleGui import init_display
from OCC.Extend.DataExchange import read_step_file
from OCC.Core.AIS import AIS_Shape
from OCC.Core.Quantity import Quantity_Color, Quantity_TOC_RGB
from OCC.Core.Aspect import Aspect_TOL_SOLID, Aspect_TypeOfLine
from OCC.Core.Prs3d import Prs3d_LineAspect
from OCC.Core.V3d import V3d_PositionalLight, V3d_TypeOfOrientation
from OCC.Core.Graphic3d import Graphic3d_RenderingParams
from OCC.Core.TopoDS import TopoDS_Shape
from OCC.Core.BRep import BRep_Builder
from OCC.Core.BRepTools import breptools

def save_view_as_image(display, filename, camera_position):
    """ Save the current view from display to an image file. """
    display.View.SetProj(camera_position[0], camera_position[1], camera_position[2])
    display.FitAll()
    display.View.Dump(filename)  # Captures the view into an image file
    
    
def setup_and_save_images(step_file, output_dir, edge_color=None, line_width=2.0, transparency=0.8):
    display, start_display, add_menu, add_function_to_menu = init_display()

    # Load STEP file
    shape = read_step_file(step_file)

    # Create an AIS_Shape to manipulate visual properties
    ais_shape = AIS_Shape(shape)
    display.Context.Display(ais_shape, True)

    # Adjust width and transparency
    ais_shape.SetWidth(line_width)
    ais_shape.SetTransparency(transparency)


    # Set edge color and line width for better contrast
    # if edge_color:
    #     edge_color_obj = Quantity_Color(edge_color[0], edge_color[1], edge_color[2], Quantity_TOC_RGB)
    # else:
    #     edge_color_obj = Quantity_Color(0, 0, 0, Quantity_TOC_RGB)  # Default to black if not specified

    # line_aspect = Prs3d_LineAspect(edge_color_obj, Aspect_TypeOfLine.Aspect_TOL_SOLID, line_width)
    # ais_shape.Attributes().SetLineAspect(line_aspect)

    
    # Update the context to apply new styles
    display.Context.UpdateCurrentViewer()

    cad_part_name = os.path.splitext(os.path.basename(step_file))[0]

    # Camera positions for different views
    views = {
        'view_1': (1, 1, 1),
        'view_2': (-1, -1, 1),
        'view_3': (-1, 1, -1),
    }

    # Save views to images
    for view_name, camera_position in views.items():
        output_filename = os.path.join(output_dir, f"{cad_part_name}_{view_name}.png")
        save_view_as_image(display, output_filename, camera_position)
        
        
def generate_cad_images_from_step(step_file_path, output_dir):
    """
    Dada la ruta a un archivo .step y una carpeta de salida,
    renderiza las vistas definidas y guarda las imágenes resultantes.
    Devuelve una lista con las rutas de las imágenes generadas.
    """
    os.makedirs(output_dir, exist_ok=True)
    setup_and_save_images(step_file_path, output_dir, line_width=2.0, transparency=0.001)
    cad_part_name = os.path.splitext(os.path.basename(step_file_path))[0]
    view_names = ["view_1", "view_2", "view_3"]
    image_paths = [os.path.join(output_dir, f"{cad_part_name}_{view}.png") for view in view_names]
    return image_paths
