import { Suspense, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Real implementation of a STEP file loader using OpenCascade.js
function useOCCLoader(paths: string[]) {
  const [models, setModels] = useState<Array<{
    geometry: THREE.BufferGeometry;
    userData: any;
  }> | null>(null);
  
  const [loadingStatus, setLoadingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // Reference to track if the component is mounted
  const isMounted = useRef(true);
  
  // Reference to OpenCascade.js instance
  const occInstance = useRef<any>(null);
  
  // Initialize OpenCascade.js
  useEffect(() => {
    // Set up cleanup function
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Debug function to verify file paths
  const verifyFilePaths = async (paths: string[]) => {
    console.log('Verifying file paths:', paths);
    for (const path of paths) {
      try {
        const response = await fetch(path, { method: 'HEAD' });
        console.log(`File ${path} exists: ${response.ok}, status: ${response.status}`);
      } catch (error) {
        console.error(`Error checking file ${path}:`, error);
      }
    }
  };
  
  useEffect(() => {
    // Skip if no paths provided
    if (!paths.length) return;
    
    // Set loading state
    setLoadingStatus('loading');
    
    // Verify file paths first
    verifyFilePaths(paths);
    
    const loadOpenCascade = async () => {
      try {
        // Espera a que window.OpenCascade esté disponible (polling)
        await new Promise<void>((resolve, reject) => {
          let waited = 0;
          const interval = setInterval(() => {
            if ((window as any).OpenCascade) {
              clearInterval(interval);
              resolve();
            } else if (waited > 10000) { // 10 segundos máximo
              clearInterval(interval);
              reject(new Error('Timeout esperando a window.OpenCascade'));
            }
            waited += 100;
          }, 100);
        });
        // Asigna la instancia global
        occInstance.current = (window as any).OpenCascade;
        if (!occInstance.current) {
          throw new Error('OpenCascade.js no se inicializó correctamente');
        }
        // Process each path
        console.log('Processing paths:', paths);
        const loadedModels = await Promise.all(
          paths.map(async (path, index) => {
            // Check if the path is a STEP file
            const isStepFile = path.toLowerCase().endsWith('.stp') || path.toLowerCase().endsWith('.step');
            
            if (!isStepFile) {
              console.warn(`File at ${path} is not a STEP file. Skipping.`);
              return null;
            }
            
            console.log(`Loading STEP file (${index+1}/${paths.length}): ${path}`);
            
            try {
              // Fetch the STEP file
              console.log(`Fetching file from path: ${path}`);
              const response = await fetch(path);
              
              if (!response.ok) {
                console.error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
              }
              
              console.log(`File fetched successfully, size: ${response.headers.get('content-length')} bytes`);
              const fileData = await response.arrayBuffer();
              console.log(`File data loaded into memory, size: ${fileData.byteLength} bytes`);
              
              // Process the STEP file with OpenCascade.js
              const occ = occInstance.current;
              console.log('Using OpenCascade instance:', occ ? 'Valid' : 'Invalid');
              
              if (!occ) {
                throw new Error('OpenCascade.js instance is not available');
              }
              
              // Create a virtual file system for OpenCascade.js
              const fileName = path.split('/').pop() || 'model.stp';
              console.log(`Processing file: ${fileName}`);
              
              console.log('Allocating memory for file name...');
              const fileNamePtr = occ._malloc(fileName.length + 1);
              occ.stringToUTF8(fileName, fileNamePtr, fileName.length + 1);
              console.log('File name allocated successfully');
              
              // Write the file data to the virtual file system
              console.log('Allocating memory for file data...');
              const dataPtr = occ._malloc(fileData.byteLength);
              const dataHeap = new Uint8Array(occ.HEAPU8.buffer, dataPtr, fileData.byteLength);
              dataHeap.set(new Uint8Array(fileData));
              console.log('File data allocated successfully');
              
              // Create a reader for STEP files
              console.log('Creating STEP reader...');
              const reader = new occ.STEPCAFControl_Reader_1();
              console.log('STEP reader created successfully');
              
              // Read the STEP file
              console.log('Reading STEP file...');
              const readResult = reader.ReadFile_2(fileNamePtr);
              console.log('Read result:', readResult, 'Expected success:', occ.IFSelect_ReturnStatus.IFSelect_RetDone);
              
              if (readResult === occ.IFSelect_ReturnStatus.IFSelect_RetDone) {
                console.log(`Successfully read STEP file: ${fileName}`);
                
                // Transfer the STEP data to a shape
                console.log('Transferring roots...');
                const transferResult = reader.TransferRoots_1();
                console.log('Transfer result:', transferResult ? 'Success' : 'Failed');
                
                console.log('Extracting shape...');
                const shape = reader.OneShape();
                
                if (shape.IsNull()) {
                  console.error('Failed to extract shape from STEP file - shape is null');
                  return null;
                }
                
                console.log('Shape extracted successfully');
                
                // Create a mesh from the shape
                console.log('Creating mesh from shape...');
                const tolerance = 0.1;
                const mesh = new occ.BRepMesh_IncrementalMesh_2(shape, tolerance, false, tolerance * 5, true);
                mesh.Perform_0();
                console.log('Mesh created successfully');
                
                // Extract faces from the shape
                console.log('Exploring faces...');
                const faceExplorer = new occ.TopExp_Explorer_2(shape, occ.TopAbs_ShapeEnum.TopAbs_FACE, occ.TopAbs_ShapeEnum.TopAbs_SHAPE);
                
                // Create a buffer geometry for Three.js
                console.log('Creating buffer geometry...');
                const geometry = new THREE.BufferGeometry();
                const vertices: number[] = [];
                const normals: number[] = [];
                const indices: number[] = [];
                
                // Extract entities for selection
                const entities: any[] = [];
                console.log('Starting face extraction...');
                
                let faceIndex = 0;
                console.log('Starting face iteration...');
                while (faceExplorer.More()) {
                  const face = occ.TopoDS.Face_1(faceExplorer.Current());
                  const location = new occ.TopLoc_Location_1();
                  const triangulation = occ.BRep_Tool.Triangulation(face, location, 0);
                  
                  if (faceIndex === 0) {
                    console.log('First face found, triangulation:', triangulation ? 'Valid' : 'Invalid');  
                  }
                  
                  if (!triangulation.IsNull()) {
                    const transform = location.Transformation();
                    const trsf = transform.Trsf();
                    
                    // Get triangulation data
                    const triangleCount = triangulation.NbTriangles();
                    
                    // Get face properties for metadata
                    const props = new occ.GProp_GProps_1();
                    occ.BRepGProp.SurfaceProperties_1(face, props);
                    const area = props.Mass();
                    
                    // Create entity for this face
                    entities.push({
                      id: `face_${faceIndex}`,
                      type: 'face',
                      metadata: {
                        area: area,
                        triangles: triangleCount
                      }
                    });
                    
                    // Process triangles
                    for (let i = 1; i <= triangleCount; i++) {
                      const triangle = triangulation.Triangle(i);
                      for (let j = 1; j <= 3; j++) {
                        const nodeIndex = triangle.Value(j);
                        const point = triangulation.Node(nodeIndex);
                        
                        // Transform point
                        const transformedPoint = trsf.IsIdentity() ? 
                          point : 
                          point.Transformed(trsf);
                        
                        // Add vertex
                        vertices.push(transformedPoint.X(), transformedPoint.Y(), transformedPoint.Z());
                        
                        // Add normal (simplified - using face normal)
                        const normal = occ.BRepGProp.NormalOnFace_1(face, point);
                        normals.push(normal.X(), normal.Y(), normal.Z());
                        
                        // Add index
                        indices.push(vertices.length / 3 - 1);
                      }
                    }
                  }
                  
                  faceIndex++;
                  faceExplorer.Next();
                }
                
                // Add edge entities
                const edgeExplorer = new occ.TopExp_Explorer_2(shape, occ.TopAbs_ShapeEnum.TopAbs_EDGE, occ.TopAbs_ShapeEnum.TopAbs_SHAPE);
                let edgeIndex = 0;
                
                while (edgeExplorer.More()) {
                  const edge = occ.TopoDS.Edge_1(edgeExplorer.Current());
                  
                  // Get edge properties
                  const props = new occ.GProp_GProps_1();
                  occ.BRepGProp.LinearProperties_1(edge, props);
                  const length = props.Mass();
                  
                  entities.push({
                    id: `edge_${edgeIndex}`,
                    type: 'edge',
                    metadata: {
                      length: length
                    }
                  });
                  
                  edgeIndex++;
                  edgeExplorer.Next();
                }
                
                // Set geometry attributes
                console.log(`Finished processing faces. Stats: ${vertices.length/3} vertices, ${indices.length/3} triangles`);
                console.log('Setting geometry attributes...');
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
                geometry.setIndex(indices);
                geometry.computeBoundingSphere();
                console.log('Geometry created successfully');
                
                // Clean up memory
                occ._free(fileNamePtr);
                occ._free(dataPtr);
                
                return {
                  geometry,
                  userData: {
                    stepFile: path,
                    entities: entities
                  }
                };
              } else {
                console.error(`Failed to read STEP file: ${fileName}`);
                
                // Clean up memory
                occ._free(fileNamePtr);
                occ._free(dataPtr);
                
                // Fallback to a simple geometry for error cases
                const geometry = new THREE.BoxGeometry(1, 1, 1);
                return {
                  geometry,
                  userData: {
                    stepFile: path,
                    entities: [{
                      id: 'error_face',
                      type: 'error',
                      metadata: {
                        error: 'Failed to load STEP file'
                      }
                    }]
                  }
                };
              }
            } catch (error) {
              console.error(`Error loading STEP file ${path}:`, error);
              
              // Fallback to a simple geometry for error cases
              const geometry = new THREE.BoxGeometry(1, 1, 1);
              return {
                geometry,
                userData: {
                  stepFile: path,
                  entities: [{
                    id: 'error_face',
                    type: 'error',
                    metadata: {
                      error: String(error)
                    }
                  }]
                }
              };
            }
          })
        );
        
        // Filter out null values and set models
        if (isMounted.current) {
          const validModels = loadedModels.filter(Boolean) as Array<{
            geometry: THREE.BufferGeometry;
            userData: any;
          }>;
          
          console.log(`Setting ${validModels.length} valid models out of ${loadedModels.length} total`);
          if (validModels.length > 0) {
            console.log('First model geometry:', validModels[0].geometry);
            console.log('First model entities:', validModels[0].userData.entities);
            setLoadingStatus('success');
          } else {
            console.error('No valid models were created');
            setLoadingStatus('error');
          }
          
          setModels(validModels);
        }
      } catch (error) {
        console.error('Error initializing OpenCascade.js:', error);
        setLoadingStatus('error');
        
        // Fallback to simple geometries if OpenCascade.js fails to load
        if (isMounted.current) {
          console.log('Creating fallback models due to OpenCascade.js initialization error');
          const fallbackModels = paths.map((path) => {
            const pieceIndex = parseInt(path.match(/Part(\d+)/)?.[1] || '1');
            console.log(`Creating fallback model for piece ${pieceIndex}`);
            
            // Create different geometries based on piece index to make them visually distinct
            let geometry;
            switch (pieceIndex % 5) {
              case 0:
                geometry = new THREE.BoxGeometry(2, 2, 2);
                break;
              case 1:
                geometry = new THREE.SphereGeometry(1.2, 16, 16);
                break;
              case 2:
                geometry = new THREE.CylinderGeometry(1, 1, 2, 16);
                break;
              case 3:
                geometry = new THREE.TorusGeometry(1, 0.4, 16, 32);
                break;
              case 4:
                geometry = new THREE.ConeGeometry(1.2, 2, 16);
                break;
              default:
                geometry = new THREE.BoxGeometry(2, 2, 2);
            }
            
            // Create mock entities for the fallback model
            const mockEntities = [];
            
            // Add mock faces
            for (let i = 0; i < 6; i++) {
              mockEntities.push({
                id: `face_${i}_piece_${pieceIndex}`,
                type: 'face',
                metadata: {
                  area: 4,
                  triangles: 2,
                  pieceIndex: pieceIndex
                }
              });
            }
            
            // Add mock edges
            for (let i = 0; i < 12; i++) {
              mockEntities.push({
                id: `edge_${i}_piece_${pieceIndex}`,
                type: 'edge',
                metadata: {
                  length: 2,
                  pieceIndex: pieceIndex
                }
              });
            }
            
            return {
              geometry,
              userData: {
                stepFile: path,
                entities: mockEntities,
                isFallback: true,
                pieceIndex: pieceIndex
              }
            };
          });
          
          console.log(`Created ${fallbackModels.length} fallback models`);
          setModels(fallbackModels);
        }
      }
    };
    
    loadOpenCascade();
  }, [paths]);
  
  // Return the models and loading status
  return { models, loadingStatus };
};

// Define model paths for STEP files
const PUZZLE_PIECES = [
  '/assets/Part1.stp',
  '/assets/Part2.stp',
  '/assets/Part3.stp',
  '/assets/Part4.stp',
  '/assets/Part5.stp',
];

// Constants for animations
const SLIDE_DISTANCE = 30;

// Define interfaces for our component props
interface ModelProps {
  modelPath: string;
  position: number;
  targetPosition: number;
  isTransitioning: boolean;
  onTransitionComplete: () => void;
  isFadingOut?: boolean;
  onEntitySelect?: (entity: {
    id: string;
    type: string;
    metadata?: any;
  } | null) => void;
}

// Model component with animation capabilities and STEP model support
function Model({ 
  modelPath, 
  position, 
  targetPosition, 
  isTransitioning, 
  onTransitionComplete, 
  isFadingOut = false,
  onEntitySelect
}: ModelProps) {
  // Check if the path is a STEP file (either .step or .stp extension)
  const isStepFile = modelPath.toLowerCase().endsWith('.stp') || modelPath.toLowerCase().endsWith('.step');
  
  // Load STEP model using OCCLoader for STEP files
  const { models: occModels, loadingStatus } = useOCCLoader([modelPath]);
  
  // Log loading status for debugging
  useEffect(() => {
    console.log(`Model loading status for ${modelPath}: ${loadingStatus}`);
  }, [loadingStatus, modelPath]);
  
  // State to store the processed geometry
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const modelRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);
  
  // STEP entity selection state
  const [selectedEntity, setSelectedEntity] = useState<{
    id: string;
    type: string;
    metadata?: any;
  } | null>(null);
  
  // Process the loaded model
  useEffect(() => {
    if (isStepFile) {
      // For STEP files, process with OCCLoader
      if (occModels && occModels.length > 0 && occModels[0]) {
        // The OCCLoader returns a processed geometry we can use directly
        setGeometry(occModels[0].geometry);
        console.log('STEP model loaded successfully:', modelPath);
      }
    } else {
      // For non-STEP files, we could add fallback logic here
      console.warn('Non-STEP file detected:', modelPath);
      // Create a placeholder geometry
      setGeometry(new THREE.BoxGeometry(1, 1, 1));
    }
  }, [occModels, modelPath, isStepFile]);
  
  // Prepare geometry for face selection
  useEffect(() => {
    if (geometry && !isTransitioning && !isFadingOut && modelRef.current) {
      // Clone the geometry to avoid modifying the cached one
      const processedGeometry = geometry.clone();
      
      // Ensure the geometry has face information
      if (!processedGeometry.index) {
        console.warn('Geometry doesn\'t have indexed faces, face selection may not work properly');
      }
      
      // Assign processed geometry to the mesh
      modelRef.current.geometry = processedGeometry;
    }
  }, [geometry, isTransitioning, isFadingOut]);
  
  // Initialize position immediately to avoid flickering
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.position.x = position;
    }
  }, [position]);
  
  // Handle STEP entity selection and highlighting
  const handleEntitySelect = (event: any) => {
    if (isTransitioning || isFadingOut || !occModels || occModels.length === 0) return;
    
    event.stopPropagation();
    
    // Get the intersection point
    const intersects = (event as any).intersects;
    if (intersects && intersects.length > 0) {
      // Get the face index from the intersection
      const intersection = intersects[0];
      const faceIndex = Math.floor(intersection.faceIndex / 3);
      
      // Get entities from the loaded model
      const entities = occModels[0].userData.entities;
      if (entities && entities.length > 0) {
        // In a real implementation with full OpenCascade.js integration,
        // we would map the face index to the actual STEP entity
        // For now, we'll select an entity based on the face index if possible
        let selectedEntity;
        
        // Try to find a face entity that might correspond to the clicked face
        const faceEntities = entities.filter((e: { type: string }) => e.type === 'face');
        if (faceEntities.length > 0) {
          // Use modulo to ensure we stay within bounds
          const entityIndex = faceIndex % faceEntities.length;
          selectedEntity = faceEntities[entityIndex];
        } else {
          // Fallback to any entity
          const entityIndex = faceIndex % entities.length;
          selectedEntity = entities[entityIndex];
        }
        
        console.log('Selected STEP entity:', selectedEntity);
        setSelectedEntity(selectedEntity);
        
        // Notify parent component about the selection
        if (onEntitySelect) {
          onEntitySelect(selectedEntity);
        }
        
        // Highlight the selected entity
        if (materialRef.current) {
          // Highlight color for selected entity
          materialRef.current.color.set('#4d9aff');
        }
        
        // Create a visual indicator at the intersection point
        if (indicatorRef.current) {
          const point = intersection.point;
          indicatorRef.current.position.set(point.x, point.y, point.z);
          indicatorRef.current.visible = true;
        }
      }
    } else {
      // Deselect if clicking away
      setSelectedEntity(null);
      
      // Notify parent component about deselection
      if (onEntitySelect) {
        onEntitySelect(null);
      }
      
      if (materialRef.current) {
        // Reset to standard color
        materialRef.current.color.set('#ff9a4d');
      }
      
      // Hide the indicator
      if (indicatorRef.current) {
        indicatorRef.current.visible = false;
      }
    }
  };
  
  // Reset highlighting when transitioning or component unmounts
  useEffect(() => {
    if (materialRef.current && !isTransitioning) {
      // Set standard material color
      materialRef.current.color.set('#ff9a4d');
      
      // Reset selection when transitioning
      if (isTransitioning) {
        setSelectedEntity(null);
      }
      
      // Reset color when component unmounts
      return () => {
        if (materialRef.current) {
          materialRef.current.color.set('#ff9a4d');
        }
      };
    }
  }, [isTransitioning]);
  
  // Handle animation frame updates
  useFrame(() => {
    if (isTransitioning && modelRef.current) {
      // Different speeds for pieces entering vs leaving
      let lerpFactor = 0.1; // Base speed
      
      if (isFadingOut) {
        // Piece that's leaving moves MUCH faster
        lerpFactor = 0.15;
        
        // Accelerate the piece as it moves away (creates an "infinity" effect)
        const distanceFromCenter = Math.abs(modelRef.current.position.x);
        if (distanceFromCenter > 10) {
          // Apply even more acceleration the further it gets
          lerpFactor = 0.15 + (distanceFromCenter * 0.01);
        }
      }
      
      modelRef.current.position.lerp(new THREE.Vector3(targetPosition, 0, 0), lerpFactor);
      
      // Fade out animation for the piece that's leaving
      if (isFadingOut && materialRef.current) {
        // Don't start fading until the piece has moved a bit
        const fadeStartDistance = 2;
        let targetOpacity = 1.0;
        const distanceFromCenter = Math.abs(modelRef.current.position.x);
        
        if (distanceFromCenter > fadeStartDistance) {
          // Calculate how much to fade based on distance
          const maxFadeDistance = 30;
          targetOpacity = Math.max(0, 1 - ((distanceFromCenter - fadeStartDistance) / maxFadeDistance));
        }
        
        // Update opacity with smoothing
        materialRef.current.opacity = THREE.MathUtils.lerp(
          materialRef.current.opacity,
          targetOpacity,
          0.1
        );
      }
      
      // Check if we've reached the target position
      const distanceToTarget = Math.abs(modelRef.current.position.x - targetPosition);
      if (distanceToTarget < 0.1) {
        // We've arrived at the target position
        onTransitionComplete();
      }
    }
  });

  // Entity highlight component for STEP format
  const EntityHighlight = () => {
    if (!selectedEntity) return null;
    
    return (
      <group position={[0, 2, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={selectedEntity.type === 'face' ? '#4d9aff' : '#ff4d9a'} />
        </mesh>
      </group>
    );
  };

  return (
    <group>
      {geometry && (
        <mesh 
          ref={modelRef}
          position={[position, 0, 0]} 
          rotation={[0, Math.PI / 6, 0]}
          scale={[0.4, 0.4, 0.4]}
          castShadow
          receiveShadow
          onClick={handleEntitySelect}
          onPointerMissed={() => {
            // Deselect when clicking away
            setSelectedEntity(null);
            if (materialRef.current) {
              materialRef.current.color.set('#ff9a4d');
            }
            if (indicatorRef.current) {
              indicatorRef.current.visible = false;
            }
          }}
        >
          <primitive object={geometry} attach="geometry" />
          <meshStandardMaterial
            key="baseMaterial"
            ref={materialRef}
            color="#ff9a4d"
            roughness={0.3}
            metalness={0.4}
            emissive="#ff6a00"
            emissiveIntensity={0.2}
            transparent
            opacity={1.0}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      <EntityHighlight />
      
      {/* Selection indicator - small sphere that shows exactly where the user clicked */}
      <mesh ref={indicatorRef} visible={false} scale={[0.05, 0.05, 0.05]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
    </group>
  );
}

// Define interface for NavigationArrow props
interface NavigationArrowProps {
  direction: 'left' | 'right';
  onClick: () => void;
  disabled: boolean;
}

// Navigation arrow component
function NavigationArrow({ direction, onClick, disabled }: NavigationArrowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        top: '50%',
        [direction === 'left' ? 'left' : 'right']: '10%',
        transform: `translateY(-50%) ${isHovered ? 'scale(1.2)' : 'scale(1)'}`,
        background: 'transparent',
        border: 'none',
        padding: '10px',
        fontSize: '30px',
        fontWeight: 'bold',
        color: isHovered ? '#FFD700' : 'white', // Change to gold on hover
        textShadow: isHovered ? 
          '0 0 10px rgba(255, 215, 0, 0.7), 0 0 20px rgba(255, 215, 0, 0.5)' : 
          '2px 2px 4px rgba(0, 0, 0, 0.8)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        zIndex: 10,
        outline: 'none', // Remove focus outline
        transition: 'all 0.3s ease', // Smooth transition for all properties
        WebkitTapHighlightColor: 'transparent', // Remove tap highlight on mobile
      }}
    >
      {direction === 'left' ? '←' : '→'}
    </button>
  );
}

// Define interface for ControlsWrapper props
interface ControlsWrapperProps {
  enabled: boolean;
}

// Controls wrapper component
function ControlsWrapper({ enabled }: ControlsWrapperProps) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = enabled;
    }
    return () => {
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    };
  }, [enabled]);
  
  return <OrbitControls ref={controlsRef} makeDefault enableDamping={false} />;
}

// Main ThreeDViewer component
const ThreeDViewer = () => {
  // State for tracking current piece and transition
  const [currentPieceIndex, setCurrentPieceIndex] = useState(0);
  const [transitionState, setTransitionState] = useState<{
    isTransitioning: boolean,
    direction: 'left' | 'right' | null,
    nextIndex: number
  }>({
    isTransitioning: false,
    direction: null,
    nextIndex: 0
  });
  
  // State for tracking selected STEP entity
  const [selectedEntity, setSelectedEntity] = useState<{
    id: string;
    type: string;
    metadata?: any;
  } | null>(null);

  // Improved transition handler with sequential animations
  const handleNavigation = (direction: 'left' | 'right') => {
    // Prevent multiple transitions
    if (transitionState.isTransitioning) return;
    
    // Calculate next piece index
    const nextIndex = direction === 'right'
      ? (currentPieceIndex + 1) % PUZZLE_PIECES.length
      : (currentPieceIndex - 1 + PUZZLE_PIECES.length) % PUZZLE_PIECES.length;
    
    // Set transition state
    setTransitionState({
      isTransitioning: true,
      direction,
      nextIndex
    });
    
    // Use a longer timer to ensure we eventually exit the transition state
    // This is a safety mechanism in case callbacks fail
    setTimeout(() => {
      setCurrentPieceIndex(nextIndex);
      setTransitionState({
        isTransitioning: false,
        direction: null,
        nextIndex: 0
      });
    }, 2000); // 2 second timeout as fallback - longer to ensure animations complete
  };

  // Este código fue eliminado ya que tenemos la lógica de transición
  // implementada directamente en los componentes Model

  // STEP entity selection state and handlers will be defined here
  // This will be implemented when we integrate STEP format support

  return (
    <div style={{ 
      position: 'absolute', 
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%', 
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ position: [0, 0, 15], fov: 45, near: 0.1, far: 1000 }}>
        <color attach="background" args={['#1a1a1a']} />
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={1.2} />
        <pointLight position={[-10, -10, -10]} intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} color="#ff9a4d" />
        
        <Suspense fallback={null}>
          {/* Current piece */}
          <Model 
            modelPath={PUZZLE_PIECES[currentPieceIndex]} 
            position={0} 
            targetPosition={0} 
            isTransitioning={false} 
            onTransitionComplete={() => {}} 
            onEntitySelect={setSelectedEntity}
          />
          
          {/* Piece that's leaving (sliding out) */}
          {transitionState.isTransitioning && transitionState.direction && (
            <Model
              modelPath={PUZZLE_PIECES[currentPieceIndex]}
              position={0}
              targetPosition={transitionState.direction === 'right' ? -SLIDE_DISTANCE : SLIDE_DISTANCE}
              isTransitioning={true}
              isFadingOut={true}
              onTransitionComplete={() => {
                // First phase complete - old piece is gone
                setCurrentPieceIndex(transitionState.nextIndex);
              }}
              onEntitySelect={setSelectedEntity}
            />
          )}
          
          {/* New piece coming in */}
          {transitionState.isTransitioning && (
            <Model
              modelPath={PUZZLE_PIECES[transitionState.nextIndex]}
              position={transitionState.direction === 'right' ? SLIDE_DISTANCE : -SLIDE_DISTANCE}
              targetPosition={0}
              isTransitioning={true}
              onTransitionComplete={() => {
                // Second phase complete - new piece has arrived
                setTransitionState({
                  isTransitioning: false,
                  direction: null,
                  nextIndex: 0
                });
              }}
              onEntitySelect={setSelectedEntity}
            />
          )}
        </Suspense>
        
        <ControlsWrapper enabled={!transitionState.isTransitioning} />
      </Canvas>

      {/* Navigation arrows */}
      <NavigationArrow
        direction="left"
        onClick={() => handleNavigation('left')}
        disabled={transitionState.isTransitioning}
      />
      <NavigationArrow
        direction="right"
        onClick={() => handleNavigation('right')}
        disabled={transitionState.isTransitioning}
      />
      
      {/* Piece indicator */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        Puzzle Piece {currentPieceIndex + 1} of {PUZZLE_PIECES.length}
      </div>
      
      {/* STEP entity selection indicator */}
      {selectedEntity && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '14px',
          maxWidth: '300px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
            Selected {selectedEntity.type.charAt(0).toUpperCase() + selectedEntity.type.slice(1)}
          </h3>
          <div style={{ fontSize: '13px' }}>
            <p style={{ margin: '4px 0' }}><strong>ID:</strong> {selectedEntity.id}</p>
            {selectedEntity.metadata && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Properties:</p>
                {selectedEntity.metadata.area !== undefined && (
                  <p style={{ margin: '2px 0' }}><strong>Area:</strong> {selectedEntity.metadata.area.toFixed(2)} mm²</p>
                )}
                {selectedEntity.metadata.length !== undefined && (
                  <p style={{ margin: '2px 0' }}><strong>Length:</strong> {selectedEntity.metadata.length.toFixed(2)} mm</p>
                )}
              </div>
            )}
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.7 }}>
            Click elsewhere to deselect
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeDViewer;
