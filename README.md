# Documentación Personal del Proyecto CAD + LLM

Este README es solo para uso personal. Aquí se documentan las configuraciones específicas que debes tener en cuenta para que el proyecto funcione correctamente en tu entorno local.

---

## 1. Configuración del archivo `.env`

Debes crear un archivo `.env` en la raíz del proyecto con la siguiente variable:

```
OPENAI_API_KEY=tu_clave_de_openai
```

- Asegúrate de que la clave sea válida y tenga permisos suficientes para el modelo que vas a usar.
- Si usas otro nombre de variable o necesitas más variables, añádelas aquí.

---

## 2. Configuración de `langgraph.json`

El archivo `langgraph.json` define la estructura y parámetros del grafo de flujo de trabajo. Ejemplo de configuración mínima:

```json
{
  "workflow": "default",
  "nodes": [
    "entrada_prompt",
    "generar_pieza",
    "extraer_codigo",
    "ejecutar_codigo",
    "questions",
    "answers",
    "feedback"
  ],
  "edges": [
    {"from": "entrada_prompt", "to": "generar_pieza"},
    {"from": "generar_pieza", "to": "extraer_codigo"},
    {"from": "extraer_codigo", "to": "ejecutar_codigo"},
    {"from": "ejecutar_codigo", "to": "questions"},
    {"from": "questions", "to": "answers"},
    {"from": "answers", "to": "feedback"}
  ]
}
```

- Modifica los nodos y edges según tu flujo de trabajo personalizado.
- Si necesitas parámetros adicionales, agrégalos en este archivo.

---

## 3. Dependencias (`requirements.txt`)

El archivo `requirements.txt` contiene:

```
openai
langgraph
cadquery
pythonocc-core
```

**Recomendación:**
- Instala `cadquery` y `pythonocc-core` con conda para evitar problemas de dependencias nativas:
  ```sh
  conda install -c conda-forge cadquery pythonocc-core
  ```
- El resto de dependencias instálalas con pip:
  ```sh
  pip install -r requirements.txt
  ```

---

Guarda este README solo como referencia personal para tu entorno y configuración.


### 5. Configura tu clave de OpenAI
Asegúrate de tener la variable de entorno `OPENAI_API_KEY` configurada:

En Linux/Mac:
```sh
export OPENAI_API_KEY="tu_clave_aqui"
```
En Windows (cmd):
```cmd
set OPENAI_API_KEY=tu_clave_aqui
```
En Windows (PowerShell):
```powershell
$env:OPENAI_API_KEY="tu_clave_aqui"
```

## Uso
1. Ejecuta el archivo principal `main.py`:

```sh
python main.py
```

2. Sigue las instrucciones en consola para generar y verificar piezas CAD.

## Notas
- Si tienes problemas con dependencias, asegúrate de usar conda para instalar `cadquery` y `pythonocc-core`.
- El proyecto genera imágenes y archivos STEP en la carpeta indicada.
- Puedes modificar los prompts y el flujo de trabajo en `main.py` y los módulos dentro de `utils/parts/`.

## Estructura del proyecto
```
├── main.py
├── requirements.txt
├── README.md
└── utils
    └── parts
        ├── codigo.py
        ├── fotos.py
        ├── qa_verification.py
        └── ...
```

## Créditos
- Basado en CadQuery, pythonocc-core y OpenAI API.
