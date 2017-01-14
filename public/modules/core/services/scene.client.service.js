'use strict';

//Scene service used for managing scene
angular.module('core').service('Scene', ['$rootScope', '$window', '$document', '$log',
  function($rootScope, $window, $document, $log) {
    //---------------------------------------------------
    //  Initialization
    //---------------------------------------------------
    var scope = this;

    // Static variables
    var SIZE_BOX = 1500;
    var SIZE_GAP = 100;
    var CAMERA_ANGLE = 45;
    var CAMERA_NEAR = 1;
    var CAMERA_FAR = SIZE_BOX * 10;
    var CLR_FACE = 0xcecece;
    var CLR_EDGE = 0x333333;
    var CLR_SELECTED = 0xca00f7;

    // Geometry types
    scope.GEOMETRY_TYPES = {
      model: 1,
      face:  1 << 1,
      edge:  1 << 2,
      curve: 1 << 3,
      point: 1 << 4
    };

    // Selection modes
    scope.SELECTION_MODES =  {
      single:   0,
      multiple: 1
    };
    scope.highlightSelObject = true;

    // Material definitions
    var meshDefaultMaterial = new $window.THREE.MeshStandardMaterial({
      color: CLR_FACE,
      transparent: true,
      opacity: 0.8,
      emissive: 0x000000,
      side: $window.THREE.DoubleSide
    });
    var meshAnalysisMaterial = new $window.THREE.MeshNormalMaterial({
      side: $window.THREE.DoubleSide
    });
    var meshWireframeMaterial = new $window.THREE.MeshBasicMaterial({
      wireframe: true
    });
    var meshShinyGlassMaterial = new $window.THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.8,
      reflectivity: 0.5,
      envMap: (function() {
        return new $window.THREE.CubeTextureLoader()
        .setPath('modules/core/images/cube/')
        .load(['posx.jpg','negx.jpg', 'posy.jpg','negy.jpg', 'posz.jpg', 'negz.jpg']);
      })(),
      combine: $window.THREE.MixOperation,
      side: $window.THREE.DoubleSide
    });
    var lineDefaultMaterial = new $window.THREE.LineBasicMaterial({
      color: CLR_EDGE,
    });
    scope.DISPLAY_MODES = {
      shaded:     1,
      rendered:   2,
      analysis:   3,
      mesh:       4,
      wireframe:  5
    };
    scope.displayMode = scope.DISPLAY_MODES.shaded;

    // Scene definitions
    var container;
    var renderer;
    var canvas;
    var cameras = [];
    var activeCamera;
    var scenes = [];
    var activeScene;
    var eyeLight;
    var trackball;
    var raycaster;
    scope.selectType = 0;
    scope.selectMode = scope.SELECTION_MODES.multiple;
    scope.numSelectors = 0;
    var selects = [];
    var mouse = new $window.THREE.Vector2();
    var transformer;

    // Transient variables
    var i = 0;
    var j = 0;
    var k = 0;

    //---------------------------------------------------
    //  Callbacks
    //---------------------------------------------------
    /**
     * Scene
     */
    // Initialize scene
    scope.initialize = function() {
      // Check webgl
      if (!$window.Detector.webgl) {
        $window.Detector.addGetWebGLMessage();
        return;
      }

      // Create camera
      createCamera();

      // Create render
      createRenderer();

      // Create scene
      createScene();

      // Create helpers
      createHelpers();

      // Create lights
      createLights();

      // Create trackball
      createTrackball();

      // Create raycaster
      raycaster = new $window.THREE.Raycaster();

      // Add listeners
      $window.addEventListener('resize', onWindowResize, false);
      canvas.addEventListener('mousedown', onCanvasMouseDown, false);
      canvas.addEventListener('mousemove', onCanvasMouseMove, false);
      canvas.addEventListener('mouseup', onCanvasMouseUp, false);
      $document[0].addEventListener('keydown', onCanvasKeyDown, false);
      $document[0].addEventListener('keyup', onCanvasKeyUp, false);

      // Animate
      animate();
    };

    // Query models
    scope.queryModels = function(onSuccess) {
      var modelNames = [];
      activeScene.traverse(function(object) {
        if (object.type === scope.GEOMETRY_TYPES.model) modelNames.push(object.name);
      });
      if (onSuccess) onSuccess(modelNames);
    };

    // Load model
    scope.loadModel = function(data, onSuccess) {
      // Check input data
      if (typeof data === 'undefined') return;

      // Get display settings
      var displaySettings = getDisplaySettings();

      // Count instances
      var count = countModels(data.name) + 1;

      // Create scene object
      var model = new $window.THREE.Object3D();
      model.name = data.name;
      model.displayName = model.name + ' #' + count;
      model.type = scope.GEOMETRY_TYPES.model;
      model.box = new $window.THREE.Box3();
      var faces = new $window.THREE.Object3D();
      model.add(faces);
      var edges = new $window.THREE.Object3D();
      model.add(edges);

      // Create faces
      for (i = 0; i < data.meshes.length; i++) {
        // Get mesh.
        let mesh = data.meshes[i];

        // Save mesh
        if (mesh.type === 'surfaceMesh') {
          // Create geometry
          let geometry = new $window.THREE.Geometry();

          // Save vertices.
          for (j = 0; j < mesh.nodes.count; j++) {
            geometry.vertices.push(
              new $window.THREE.Vector3(
                mesh.nodes.points[j * 3],
                mesh.nodes.points[j * 3 + 1],
                mesh.nodes.points[j * 3 + 2]
              ));
          }

          // Save facets
          for (j = 0; j < mesh.facets.count; j++) {
            let a = mesh.facets.indices[j * 3];
            let b = mesh.facets.indices[j * 3 + 1];
            let c = mesh.facets.indices[j * 3 + 2];
            let facet = new $window.THREE.Face3(a, b, c);
            facet.vertexNormals = [
              new $window.THREE.Vector3(mesh.nodes.normals[a * 3], mesh.nodes.normals[a * 3 + 1], mesh.nodes.normals[a * 3 + 2]),
              new $window.THREE.Vector3(mesh.nodes.normals[b * 3], mesh.nodes.normals[b * 3 + 1], mesh.nodes.normals[b * 3 + 2]),
              new $window.THREE.Vector3(mesh.nodes.normals[c * 3], mesh.nodes.normals[c * 3 + 1], mesh.nodes.normals[c * 3 + 2])];
            geometry.faces.push(facet);
          }

          // Evaluate geometry addtional data
          geometry.key = mesh.id;
          geometry.computeFaceNormals();
          geometry.computeBoundingBox();
          model.box.union(geometry.boundingBox);

          // Create mesh
          var face = new $window.THREE.Mesh(geometry, displaySettings.meshMaterial.clone());
          face.savedMaterial = face.material;
          face.visible = displaySettings.meshVisibility;
          face.type = scope.GEOMETRY_TYPES.face;
          face.selected = false;

          // Add to parent
          faces.add(face);
        } else if (mesh.type === 'curveMesh' && mesh.cardinal === 3) {
          // Create geometry
          let geometry = new $window.THREE.Geometry();

          // Save vertices.
          for (j = 0; j < mesh.nodes.count; j++) {
            geometry.vertices.push(
              new $window.THREE.Vector3(
                mesh.nodes.points[j * 3],
                mesh.nodes.points[j * 3 + 1],
                mesh.nodes.points[j * 3 + 2]
              ));
          }

          // Evaluate geometry addtional data
          geometry.key = mesh.id;
          geometry.computeBoundingBox();

          // Create line
          var edge = new $window.THREE.Line(geometry, displaySettings.lineMaterial.clone());
          edge.savedMaterial = edge.material;
          edge.visible = displaySettings.lineVisibility;
          edge.type = scope.GEOMETRY_TYPES.edge;
          edge.selected = false;

          // Add to parent
          edges.add(edge);
        }
      }

      // Update model center
      model.center = new $window.THREE.Vector3();
      model.center.copy(model.box.min).add(model.box.max).multiplyScalar(0.5);

      // Add to scene
      activeScene.add(model);

      // Fit view.
      scope.fitView();

      // Post-processing
      if (onSuccess) onSuccess(model);
    };

    // Update displays
    scope.updateDisplays = function (object) {
      if (typeof object === 'undefined') {
        // Default to update scene displays
        scope.updateDisplays(activeScene);
      } else {
        // Ignore helpers
        if (object instanceof $window.THREE.AxisHelper ||
          object instanceof $window.THREE.GridHelper)
          return;

        // Update displays based on display settings
        if (typeof object.material !== 'undefined') {
          let displaySettings = getDisplaySettings();
          if (object instanceof $window.THREE.Mesh) {
            object.material = displaySettings.meshMaterial.clone();
            object.savedMaterial = displaySettings.meshMaterial.clone();
            object.visible = displaySettings.meshVisibility;
          } else if (object instanceof $window.THREE.Line) {
            object.material = displaySettings.lineMaterial.clone();
            object.savedMaterial = displaySettings.lineMaterial.clone();
            object.visible = displaySettings.lineVisibility;
          }

          // Update specific displays
          if(object.visible) {
            // Display selected
            if(object.selected) {
              if(typeof object.material.color !== 'undefined')
                object.material.color.setHex(CLR_SELECTED);
            }
          }
        }
        if (typeof object.children !== 'undefined' && object.children.length > 0) {
          object.children.forEach(function(child){
            scope.updateDisplays(child);
          });
        }
      }
    };

    // Remove object
    scope.removeObject = function(name) {
      // Check input data
      if (name === null) return;

      // Remove object
      var index = 0;
      activeScene.children.forEach(function(object) {
        if (object.displayName === name) {
          activeScene.children.splice(index, 1);
          return;
        }
        index++;
      });
    };

    // Highlight object
    scope.clearView = function() {
      setSelected(activeScene, false);
      selects = [];
      scope.updateDisplays();
      activeScene.remove(transformer);
      transformer = null;
    };

    /**
     * View
     */
    // Fit view
    scope.fitView = function(direction) {
      // Update scene box
      updateSceneBox(activeScene);
      if (activeScene.box.isEmpty()) return;

      // Evaluate direction
      let v = new $window.THREE.Vector3();
      if (typeof direction !== 'undefined')
        v.copy(direction);
      else
        v.copy(activeCamera.position).sub(activeScene.center).normalize();

      // Evaluate projection radius
      let sphere = activeScene.box.getBoundingSphere();
      let r = sphere.radius;

      // Evaluate distance
      let d = r / Math.sin(toRadian(CAMERA_ANGLE / 2.0));
      v.multiplyScalar(d);

      // Evalute eye
      let p = new $window.THREE.Vector3();
      p.copy(activeScene.center).add(v);

      // Set camera and trackball
      activeCamera.position.copy(p);
      activeCamera.lookAt(activeScene.center);
      trackball.target.copy(activeScene.center);
    };

    // Bottom view
    scope.topView = function() {
      scope.fitView(new $window.THREE.Vector3(0, 0, 1));
    };

    // Bottom view
    scope.bottomView = function() {
      scope.fitView(new $window.THREE.Vector3(0, 0, -1));
    };

    // Left view
    scope.leftView = function() {
      scope.fitView(new $window.THREE.Vector3(-1, 0, 0));
    };

    // Right view
    scope.rightView = function() {
      scope.fitView(new $window.THREE.Vector3(1, 0, 0));
    };

    // Front view
    scope.frontView = function() {
      scope.fitView(new $window.THREE.Vector3(0, -1, 0));
    };

    // Back view
    scope.backView = function() {
      scope.fitView(new $window.THREE.Vector3(0, 1, 0));
    };


    /**
     * Transformation
     */
    // Move model
    scope.moveModel = function(object) {
      // Check input data
      if (selects.length === 0) return;
      if (angular.isUndefined(selects[0].type) || selects[0].type !== scope.GEOMETRY_TYPES.model) return;

      // Attach transformer
      if (transformer === null) {
        transformer = new $window.THREE.TransformControls(activeCamera, canvas);
        activeScene.add(transformer);
      }
      transformer.attach(selects[0]);
      transformer.setMode('translate');
      transformer.addEventListener('change', render);
    };

    // Rotate model
    scope.rotateModel = function(object) {
      // Check input data
      if (selects.length === 0) return;
      if (angular.isUndefined(selects[0].type) || selects[0].type !== scope.GEOMETRY_TYPES.model) return;

      // Attach transformer
      if (transformer === null) {
        transformer = new $window.THREE.TransformControls(activeCamera, canvas);
        activeScene.add(transformer);
      }
      transformer.attach(selects[0]);
      transformer.setMode('rotate');
      transformer.addEventListener('change', render);
    };

    // Scale model
    scope.scaleModel = function(object) {
      // Check input data
      if (selects.length === 0) return;
      if (angular.isUndefined(selects[0].type) || selects[0].type !== scope.GEOMETRY_TYPES.model) return;

      // Attach transformer
      if (transformer === null) {
        transformer = new $window.THREE.TransformControls(activeCamera, canvas);
        activeScene.add(transformer);
      }
      transformer.attach(selects[0]);
      transformer.setMode('scale');
      transformer.addEventListener('change', render);
    };

    //---------------------------------------------------
    //  Listeners
    //------------------------------------------------
    // Resize
    function onWindowResize() {
      activeCamera.aspect = $window.innerWidth / $window.innerHeight;
      activeCamera.updateProjectionMatrix();
      renderer.setSize($window.innerWidth, $window.innerHeight);
    }

    // Mouse down
    function onCanvasMouseDown(event) {
      event.preventDefault();
      if (event.button !== 0) return;
      if (scope.numSelectors > 0) pickObjects();
    }

    // Mouse move
    function onCanvasMouseMove(event) {
      event.preventDefault();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // Mouse up
    function onCanvasMouseUp(event) {
      event.preventDefault();
    }

    // Key down
    function onCanvasKeyDown(event) {
      event.preventDefault();
    }

    // Key up
    function onCanvasKeyUp(event) {
      event.preventDefault();
    }

    //---------------------------------------------------
    //  Utilities
    //---------------------------------------------------
    /**
     * Math
     */
    // Convert degree to radian
    function toRadian(degree) {
      return degree / 180 * Math.PI;
    }

    // Convert radian to degree
    function toDegree(radian) {
      return radian / Math.PI * 180;
    }

    /**
     * Scene
     */
    // Create scene
    function createScene() {
      var scene = new $window.THREE.Scene();
      scenes.push(scene);
      activeScene = scene;
    }

    // Evaluate scene center
    function updateSceneBox(scene) {
      // Check input data
      if (!(scene instanceof $window.THREE.Scene)) return;

      // Update box
      let count = 0;
      scene.box = new $window.THREE.Box3();
      scene.traverse(function(object) {
        if (typeof object.type !== 'undefined' && object.type === scope.GEOMETRY_TYPES.model) {
          scene.box.union(object.box);
          count++;
        }
      });
      if (count === 0)
        scene.box.makeEmpty();

      // Update center
      scene.center = new $window.THREE.Vector3();
      if (count > 0)
        scene.center.copy(scene.box.min).add(scene.box.max).multiplyScalar(0.5);
    }

    // Create renderer
    function createRenderer() {
      container = $document[0].getElementById('canvas');
      renderer = $window.WebGLRenderingContext ?
        new $window.THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true
        }) :
        new $window.THREE.CanvasRenderer();
      renderer.setSize($window.innerWidth, $window.innerHeight);
      renderer.setPixelRatio($window.devicePixelRatio);
      renderer.autoClear = true;
      canvas = renderer.domElement;
      container.appendChild(canvas);
    }

    // Create camera
    function createCamera() {
      var camera = new $window.THREE.PerspectiveCamera(CAMERA_ANGLE, $window.innerWidth / $window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
      camera.name = 'VIEW #' + cameras.length + 1;
      camera.position.set(- SIZE_BOX * 2, - SIZE_BOX * 2, SIZE_BOX);
      camera.up.copy(new $window.THREE.Vector3(0, 0, 1));
      camera.target = new $window.THREE.Vector3();
      cameras.push(camera);
      activeCamera = camera;
    }

    // Create helpers
    function createHelpers() {
      // Grid
      var grid = new $window.THREE.GridHelper(SIZE_BOX, SIZE_GAP);
      grid.name = 'GRID';
      grid.rotateX(Math.PI / 2.0);
      activeScene.add(grid);

      // Axis
      var axis = new $window.THREE.AxisHelper(SIZE_BOX);
      axis.name = 'AXIS';
      activeScene.add(axis);
    }

    // Create lights
    function createLights() {
      eyeLight = new $window.THREE.DirectionalLight(0xffffff, 0.5);
      eyeLight.name = 'EYE LIGHT';
      eyeLight.position.set(SIZE_BOX * 2, SIZE_BOX, SIZE_BOX * 2);
      activeScene.add(eyeLight);
    }

    // Create trackball
    function createTrackball() {
      trackball = new $window.THREE.TrackballControls(activeCamera);
      trackball.rotateSpeed = 4.0;
      trackball.zoomSpeed = 2.0;
      trackball.panSpeed = 1.0;
      trackball.noZoom = false;
      trackball.noPan = false;
      trackball.staticMoving = true;
      trackball.dynamicDampingFactor = 0.3;
    }

    // Count object instances
    function countModels(name) {
      // Check input data
      if (name === null) return 0;

      // Count object instances
      var count = 0;
      activeScene.traverse(function(object) {
        if (object.type === scope.GEOMETRY_TYPES.model) {
          if (object.name === name) count++;
        }
      });
      return count;
    }

    // Get materials for display mode
    function getDisplaySettings () {
      var meshMaterial = meshDefaultMaterial;
      var lineMaterial = lineDefaultMaterial;
      var meshVisibility = true;
      var lineVisibility = true;
      switch (scope.displayMode) {
        case scope.DISPLAY_MODES.shaded:
          break;
        case scope.DISPLAY_MODES.rendered:
          lineVisibility = false;
          break;
        case scope.DISPLAY_MODES.analysis:
          meshMaterial = meshAnalysisMaterial;
          break;
        case scope.DISPLAY_MODES.mesh:
          meshMaterial = meshWireframeMaterial;
          break;
        case scope.DISPLAY_MODES.wireframe:
          meshVisibility = false;
          break;
      }
      return {
        meshMaterial: meshMaterial,
        meshVisibility: meshVisibility,
        lineMaterial: lineMaterial,
        lineVisibility: lineVisibility
      };
    }

    /**
     * Selection
     */
    // Set selected
    function setSelected (object, selected) {
      if (!(object instanceof $window.THREE.Scene))
        object.selected = selected;
      if (typeof object.children !== 'undefined' && object.children.length > 0) {
        object.children.forEach(function (child){
          setSelected(child, selected);
        });
      }
    }

    // Click pick objects
    function pickObjects() {
      raycaster.setFromCamera(mouse, activeCamera);
      let intersects = raycaster.intersectObjects(activeScene.children, true);
      if (intersects.length > 0) {
        // Get candidates by type
        let candidates = [];
        let candidate = null;
        if (scope.selectType & scope.GEOMETRY_TYPES.model) {
          candidate = getPickedModel(intersects);
          if (candidate !== null)
            candidates.push(candidate);
        }
        if (candidate === null && scope.selectType & scope.GEOMETRY_TYPES.face) {
          candidate = getPickedFace(intersects);
          if (candidate !== null)
            candidates.push(candidate);
        }
        if (candidate === null && scope.selectType & scope.GEOMETRY_TYPES.edge) {
          candidate = getPickedEdge(intersects);
          if (candidate !== null)
            candidates.push(candidate);
        }
        if (candidate === null && scope.selectType & scope.GEOMETRY_TYPES.curve) {
          candidate = getPickedCurve(intersects);
          if (candidate !== null)
            candidates.push(candidate);
        }
        if (candidate === null && scope.selectType & scope.GEOMETRY_TYPES.point) {
          candidate = getPickedPoint(intersects);
          if (candidate !== null)
            candidates.push(candidate);
        }
        if (candidates.length === 0) return;

        // Update selects
        candidates.forEach(function(candidate) {
          if (selects.length > 0 && selects.indexOf(candidate) !== -1) {
            let index = selects.indexOf(candidate);
            selects.splice(index, 1);
            setSelected(candidate, false);
          } else {
            if (scope.selectMode === scope.PICK_SINGLE) {
              selects.forEach(function(object) {
                setSelected(object, false);
              });
              selects = [];
            }
            setSelected(candidate, true);
            selects.push(candidate);
          }
        });
      }

      // Update displays
      scope.updateDisplays();

      // Broadcast
      if (selects.length > 0)
        $rootScope.$broadcast('scene.selected', selects);
    }

    // Get picked model
    function getPickedModel(intersects) {
      if (intersects.length === 0) return;
      for (i = 0; i < intersects.length; i++) {
        if (intersects[i].object instanceof $window.THREE.Mesh) {
          let candidate = intersects[i].object.parent.parent;
          if (typeof candidate.type !== 'undefined' && candidate.type === scope.GEOMETRY_TYPES.model)
            return candidate;
        }
      }
      return null;
    }

    // Get picked face
    function getPickedFace(intersects) {
      if (intersects.length === 0) return;
      for (i = 0; i < intersects.length; i++) {
        if (intersects[i].object instanceof $window.THREE.Mesh) {
          let candidate = intersects[i].object;
          if (typeof candidate.type !== 'undefined' && candidate.type === scope.GEOMETRY_TYPES.face)
            return candidate;
        }
      }
      return null;
    }

    // Get picked edge
    function getPickedEdge(intersects) {
      if (intersects.length === 0) return;
      for (i = 0; i < intersects.length; i++) {
        if (intersects[i].object instanceof $window.THREE.Line) {
          let candidate = intersects[i].object;
          if (typeof candidate.type !== 'undefined' && candidate.type === scope.GEOMETRY_TYPES.edge)
            return candidate;
        }
      }
      return null;
    }

    // Get picked curve
    function getPickedCurve(intersects) {
      if (intersects.length === 0) return;
      for (i = 0; i < intersects.length; i++) {
        if (intersects[i].object instanceof $window.THREE.Line) {
          let candidate = intersects[i].object;
          if (typeof candidate.type !== 'undefined' && candidate.type === scope.GEOMETRY_TYPES.curve)
            return candidate;
        }
      }
      return null;
    }

    // Get picked point
    function getPickedPoint(intersects) {
      if (intersects.length === 0) return;
      for (i = 0; i < intersects.length; i++) {
        if (intersects[i].object instanceof $window.THREE.Vector3) {
          let candidate = intersects[i].object;
          if (typeof candidate.type !== 'undefined' && candidate.type === scope.GEOMETRY_TYPES.point)
            return candidate;
        }
      }
      return null;
    }

     /**
     * Rendering
     */
    // Animate
    function animate() {
      $window.requestAnimationFrame(animate);
      update();
      render();
    }

    // Render
    function render() {
      renderer.render(activeScene, activeCamera);
    }

    // Update
    function update() {
      // Trackball
      if (typeof trackball !== 'undefined') trackball.update();

       // Transformer
      if (typeof transformer !== 'undefined' && transformer !== null) transformer.update();

      // Lights
      var direction = new $window.THREE.Vector3();
      direction.copy(activeCamera.position).sub(activeCamera.target).normalize();
      eyeLight.position.copy(direction);
    }

    //---------------------------------------------------
    //  Debugging
    //---------------------------------------------------
    // Create a point
    function createPoint(x, y, z) {
      var geometry = new $window.THREE.SphereGeometry(0.1, 32, 32);
      var material = new $window.THREE.MeshBasicMaterial({
        color: 0xffff00
      });
      var sphere = new $window.THREE.Mesh(geometry, material);
      sphere.position.set(x, y, z);
      activeScene.add(sphere);
    }

    // Create a box
    function createBox(model) {
      var dx = model.box.max.x - model.box.min.x;
      var dy = model.box.max.y - model.box.min.y;
      var dz = model.box.max.z - model.box.min.z;
      var geometry = new $window.THREE.BoxGeometry(dx, dy, dz);
      var material = new $window.THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true
      });
      var cube = new $window.THREE.Mesh(geometry, material);
      cube.position.copy(model.center);
      activeScene.add(cube);
    }
  }
]);
