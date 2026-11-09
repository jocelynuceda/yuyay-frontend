# medicalTerms.json

Diccionario que usa la revisión de documentos para sugerir nombres de medicamentos y dispositivos cuando el OCR los lee mal. La app solo sugiere y el cuidador acepta o descarta cada sugerencia.

| Clave | Fuente | Entradas |
|---|---|---|
| `es` | Petitorio Nacional Único de Medicamentos Esenciales 2023 (MINSA/DIGEMID). DCI transcritas del PDF escaneado y revisadas a mano, sin sales ni formas farmacéuticas. | 437 |
| `dispositivos` | Petitorio Nacional Único de Dispositivos Médicos Esenciales 2019 (MINSA/DIGEMID). Nombres genéricos. | 55 |
| `comunes` | Genéricos frecuentes en recetas peruanas que no figuran en el petitorio (por ejemplo hioscina o ketorolaco). Lista curada. | 45 |
| `rxIngredientes`, `rxMarcas` | RxNorm (National Library of Medicine, EE. UU.): ingredientes y marcas prescribibles, para medicamentos importados. | 3068 y 3044 |
| `equivalencias` | Pares inglés → español del mismo fármaco (`ibuprofen` → `ibuprofeno`). Sirven para que un nombre en inglés válido no compita con su equivalente en español. | 258 |

El archivo se carga con `import()` dinámico solo en la revisión de documentos, así que no forma parte del bundle principal.
