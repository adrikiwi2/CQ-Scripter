import os
os.makedirs('parts', exist_ok=True)

import cadquery as cq

pieza = cq.Workplane("XY").box(10, 10, 10).faces(">Z").workplane().center(0, 0).hole(4)

cq.exporters.export(pieza, 'parts/cubo_con_agujero/cubo_con_agujero.step')