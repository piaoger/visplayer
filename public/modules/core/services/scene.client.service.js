'use strict';

//Scene service used for managing scene
angular.module('core').service('Scene', ['$rootScope', '$window', '$document', '$log',

  function($rootScope, $window, $document, $log) {
    //---------------------------------------------------
    //  Initialization
    //---------------------------------------------------
    // Static variables
    var BOX_SIZE = 1500;
    var GAP_SIZE = 100;
    var CAMERA_ANGLE = 45;

    // Material definitions
    var faceDefaultMaterial = new $window.THREE.MeshPhongMaterial({
      color: 0xcecece,
      specular: 0xffffff,
      metal: true,
      shininess: 25,
      emissive: 0x000000,
      side: $window.THREE.DoubleSide
    });
    var faceAnalysisMaterial = new $window.THREE.MeshNormalMaterial({
      side: $window.THREE.DoubleSide
    });
    var faceShinyGlassMaterial = new $window.THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.5,
      reflectivity: 0.5,
      envMap: (function() {
        var path = 'modules/core/img/cube/';
        var format = '.jpg';
        var urls = [
          path + 'posx' + format, path + 'negx' + format,
          path + 'posy' + format, path + 'negy' + format,
          path + 'posz' + format, path + 'negz' + format
        ];
        var reflectionCube = $window.THREE.ImageUtils.loadTextureCube(urls);
        reflectionCube.format = $window.THREE.RGBFormat;
        return reflectionCube;
      })(),
      combine: $window.THREE.MixOperation,
      side: $window.THREE.DoubleSide
    });
    var edgeDefaultMaterial = new $window.THREE.LineBasicMaterial({
      color: 0x333333,
    });

    // Scene definitions
    var container = null;
    var renderer = null;
    var canvas = null;
    var cameras = [];
    var activeCamera = null;
    var scenes = [];
    var activeScene = null;
    var eyeLight = null;
    var orbitor = null;
    var raycaster = null;
    var isPickingEnabled = false;
    var pickType = null;
    var picked = null;
    var pickedColor = 0xe8373e;
    var transformer = null;
    var mouse = new $window.THREE.Vector2();

    // Transient variables
    var i = 0;
    var j = 0;
    var k = 0;

    //---------------------------------------------------
    //  Callbacks
    //---------------------------------------------------
    // Initialize scene
    this.initialize = function() {
      // Check webgl
      if (!$window.Detector.webgl)
        $window.Detector.addGetWebGLMessage();

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

      // Create orbitor
      orbitor = new $window.THREE.OrbitControls(activeCamera, canvas);

      // Create raycaster
      raycaster = new $window.THREE.Raycaster();

      // Add listeners
      $window.addEventListener('resize', onWindowResize, false);
      canvas.addEventListener('mousemove', onDocumentMouseMove, false);
      canvas.addEventListener('mousedown', onDocumentMouseDown, false);

      // Animate
      animate();
    };

    // Query models
    this.queryModels = function(onsuccess) {
      var modelnames = [];
      activeScene.traverse(function(object) {
        if (object.type === 'model') modelnames.push(object.name);
      });
      if (onsuccess) onsuccess(modelnames);
    };

    // Load model
    this.loadModel = function(gd, onsuccess) {
      // Check input data
      if (gd === null) return;

      // Count instances
      var count = countModels(gd.name) + 1;

      // Create scene object
      var model = new $window.THREE.Object3D();
      model.name = gd.name;
      model.displayName = model.name + ' #' + count;
      model.type = 'model';
      model.box = new $window.THREE.Box3();
      var faces = new $window.THREE.Object3D();
      model.add(faces);
      var edges = new $window.THREE.Object3D();
      model.add(edges);

      // Create faces
      for (i = 0; i < gd.faces.length; i++) {
        // Create geometry
        var faceGeometry = new $window.THREE.Geometry();
        var fd = gd.faces[i].tessellation.facets[0];
        for (j = 0; j < fd.vertexCount; j++) {
          faceGeometry.vertices.push(
            new $window.THREE.Vector3(
              fd.vertexCoordinates[j * 3],
              fd.vertexCoordinates[j * 3 + 1],
              fd.vertexCoordinates[j * 3 + 2]
            ));
        }
        for (j = 0; j < fd.facetCount; j++) {
          faceGeometry.faces.push(
            new $window.THREE.Face3(
              fd.vertexIndices[j * 3] - 1,
              fd.vertexIndices[j * 3 + 1] - 1,
              fd.vertexIndices[j * 3 + 2] - 1
            ));
        }

        // Evaluate faceGeometry addtional gd
        faceGeometry.key = gd.faces[i].id;
        faceGeometry.computeFaceNormals();
        faceGeometry.computeVertexNormals();
        faceGeometry.computeBoundingBox();
        model.box.union(faceGeometry.boundingBox);

        // Create mesh
        var faceMesh = new $window.THREE.Mesh(faceGeometry, faceDefaultMaterial.clone());

        // Add to parent
        faces.add(faceMesh);
      }

      // Create gd.edges
      for (i = 0; i < gd.edges.length; i++) {
        // Create geometry
        var edgeGeometry = new $window.THREE.Geometry();
        var ed = gd.edges[i].tessellation;
        for (j = 0; j < ed.vertexCount; j++) {
          edgeGeometry.vertices.push(
            new $window.THREE.Vector3(
              ed.points[j * 3],
              ed.points[j * 3 + 1],
              ed.points[j * 3 + 2]
            ));
        }

        // Compute geometry addtional gd
        edgeGeometry.key = ed.id;
        edgeGeometry.computeBoundingBox();

        // Create line
        var edgeMesh = new $window.THREE.Line(edgeGeometry, edgeDefaultMaterial.clone());

        // Add to parent
        edges.add(edgeMesh);
      }

      // Update model center
      model.center = new $window.THREE.Vector3();
      model.center.copy(model.box.min).add(model.box.max).multiplyScalar(0.5);

      // Add to scene
      activeScene.add(model);

      // Fit view.
      fitView();

      // Post-processing
      if (onsuccess) onsuccess(model);
    };

    // Remove object
    this.removeObject = function(objname) {
      // Check input data
      if (objname === null) return;

      // Remove object
      var index = 0;
      activeScene.children.forEach(function(object) {
        if (object.displayName === objname) {
          activeScene.children.splice(index, 1);
          return;
        }
        index++;
      });
    };

    // Fit view
    this.fitView = function () {
      // Collect box points
      var points = [];
      points.push(new $window.THREE.Vector3(activeScene.box.min.x, activeScene.box.min.y, activeScene.box.min.z));
      points.push(new $window.THREE.Vector3(activeScene.box.max.x, activeScene.box.min.y, activeScene.box.min.z));
      points.push(new $window.THREE.Vector3(activeScene.box.max.x, activeScene.box.max.y, activeScene.box.min.z));
      points.push(new $window.THREE.Vector3(activeScene.box.min.x, activeScene.box.max.y, activeScene.box.min.z));
      points.push(new $window.THREE.Vector3(activeScene.box.min.x, activeScene.box.min.y, activeScene.box.max.z));
      points.push(new $window.THREE.Vector3(activeScene.box.max.x, activeScene.box.min.y, activeScene.box.max.z));
      points.push(new $window.THREE.Vector3(activeScene.box.max.x, activeScene.box.max.y, activeScene.box.max.z));
      points.push(new $window.THREE.Vector3(activeScene.box.min.x, activeScene.box.max.y, activeScene.box.max.z));

      // Evaluate direction
      var v = new $window.THREE.Vector3();
      v.copy(activeCamera.position).sub(activeScene.center).normalize();

      // Evaluate projection radius
      var radius = null;
      points.forEach(function(point){
        var v1 = new $window.THREE.Vector3();
        v1.copy(point).sub(activeScene.center);
        var l1 = v1.dot(v);
        var v2 = new $window.THREE.Vector3();
        v2.copy(v).multiplyScalar(l1);
        var v3 = new $window.THREE.Vector3();
        v3.copy(v1).sub(v2);
        var l2 = v3.length();
        if(radius === null || radius < l2) radius = l2;
      });

      // Evaluate distance
      var d = radius / Math.atan(CAMERA_ANGLE / 2.0);
      v.multiplyScalar(d);
      var p = new $window.THREE.Vector3();
      p.copy(activeScene.center).add(v);

      // Set camera
      activeCamera.position.copy(p);
      activeCamera.lookAt(activeScene.center);
      createPoint(activeCamera.position.x, activeCamera.position.y, activeCamera.position.z);
      orbitor.target.copy(activeScene.center);
      orbitor.update();
    };

    // Top view
    this.topView = function() {
      updateSceneBox(activeScene);
      var dz = Math.abs(activeScene.box.max.z - activeScene.box.min.z);
      var dx = Math.abs(activeScene.box.max.x - activeScene.box.min.x);
      var d = Math.max(dz, dx) / 2.0;
      var x = activeScene.center.x;
      var y = activeScene.box.max.y + d * Math.atan(CAMERA_ANGLE / 2.0);
      var z = activeScene.center.z;
      activeCamera.position.set(x, y, z);
      activeCamera.lookAt(activeScene.center);
    };

    // Bottom view
    this.bottomView = function() {
      updateSceneBox(activeScene);
      var dz = Math.abs(activeScene.box.max.z - activeScene.box.min.z);
      var dx = Math.abs(activeScene.box.max.x - activeScene.box.min.x);
      var d = Math.max(dz, dx) / 2.0;
      var x = activeScene.center.x;
      var y = activeScene.box.min.y - d * Math.atan(CAMERA_ANGLE / 2.0);
      var z = activeScene.center.z;
      activeCamera.position.set(x, y, z);
      activeCamera.lookAt(activeScene.center);
    };

    // Left view
    this.leftView = function() {
      updateSceneBox(activeScene);
      var dz = Math.abs(activeScene.box.max.z - activeScene.box.min.z);
      var dx = Math.abs(activeScene.box.max.x - activeScene.box.min.x);
      var d = Math.max(dz, dx) / 2.0;
      var x = activeScene.box.min.x - d * Math.atan(CAMERA_ANGLE / 2.0);
      var y = activeScene.center.y;
      var z = activeScene.center.z;
      activeCamera.position.set(x, y, z);
      activeCamera.lookAt(activeScene.center);
    };

    // Right view
    this.rightView = function() {
      updateSceneBox(activeScene);
      var dz = Math.abs(activeScene.box.max.z - activeScene.box.min.z);
      var dx = Math.abs(activeScene.box.max.x - activeScene.box.min.x);
      var d = Math.max(dz, dx) / 2.0;
      var x = activeScene.box.max.x + d * Math.atan(CAMERA_ANGLE / 2.0);
      var y = activeScene.center.y;
      var z = activeScene.center.z;
      activeCamera.position.set(x, y, z);
      activeCamera.lookAt(activeScene.center);
    };

    // Attach transformer
    this.attachTransformer = function(object, mode) {
      // Check input data
      if (angular.isUndefined(object.type) || object.type !== 'model') return;

      // Create transformer
      if (transformer === null) {
        transformer = new $window.THREE.TransformControls(activeCamera, canvas);
        activeScene.add(transformer);
      }
      transformer.attach(object);
      transformer.setMode(mode);
      transformer.addEventListener('change', render);
    };

    // Enalbe picking
    this.enablePicking = function(enable, type) {
      isPickingEnabled = enable;
      if (isPickingEnabled) {
        picked = null;
        if (angular.isDefined(type)) pickType = type;
      } else {
        highlightObject(activeScene, false);
      }
    };

    // Highlight object
    this.clearScene = function() {
      highlightObject(activeScene, false);
      activeScene.remove(transformer);
      transformer = null;
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

    // Mouse move
    function onDocumentMouseMove(event) {
      event.preventDefault();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    // Mouse down
    function onDocumentMouseDown(event) {
      if (isPickingEnabled) pickObject();
    }

    //---------------------------------------------------
    //  Utilities
    //---------------------------------------------------
    /**
     * Scene management
     */
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
      var camera = new $window.THREE.PerspectiveCamera(CAMERA_ANGLE, $window.innerWidth / $window.innerHeight, 1, BOX_SIZE * 10);
      camera.name = 'VIEW #' + cameras.length + 1;
      camera.position.set(BOX_SIZE * 2, BOX_SIZE, BOX_SIZE * 2);
      camera.target = new $window.THREE.Vector3();
      cameras.push(camera);
      activeCamera = camera;
    }

    // Fit camera
    function fitView() {
      // Evalute camera position
      updateSceneBox(activeScene);
      var v1 = new $window.THREE.Vector3();
      var radius = v1.copy(activeScene.box.max).sub(activeScene.box.min).length();
      var v2 = new $window.THREE.Vector3();
      v2.x = 1.0;
      v2.y = 1.0;
      v2.z = 1.0;
      v2.normalize();
      v2.multiplyScalar(radius * 2.0);
      var p = new $window.THREE.Vector3();
      p.copy(activeScene.center).add(v2);
      activeCamera.position.copy(p);

      // Update camera target
      activeCamera.lookAt(activeScene.center);
      orbitor.target.copy(activeScene.center);
      orbitor.update();
    }

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
      scene.box = new $window.THREE.Box3();
      scene.traverse(function(object) {
        if (angular.isDefined(object.type) && object.type === 'model') {
          scene.box.union(object.box);
        }
      });

      // Update center
      scene.center = new $window.THREE.Vector3();
      scene.center.copy(scene.box.min).add(scene.box.max).multiplyScalar(0.5);
    }


    // Create helpers
    function createHelpers() {
      // Grid
      var grid = new $window.THREE.GridHelper(BOX_SIZE, GAP_SIZE);
      grid.name = 'GRID';
      activeScene.add(grid);

      // Axis
      var axis = new $window.THREE.AxisHelper(BOX_SIZE);
      axis.name = 'AXIS';
      activeScene.add(axis);
    }

    // Create lights
    function createLights() {
      eyeLight = new $window.THREE.DirectionalLight(0xffffff, 0.5);
      eyeLight.name = 'EYE LIGHT';
      eyeLight.position.set(BOX_SIZE, BOX_SIZE, BOX_SIZE);
      activeScene.add(eyeLight);
    }

    // Count object instances
    function countModels(name) {
      // Check input data
      if (name === null) return 0;

      // Count object instances
      var count = 0;
      activeScene.traverse(function(object) {
        if (object.type === 'model') {
          if (object.name === name) count++;
        }
      });
      return count;
    }

    /**
     * Selection
     */
    // Pick object
    function pickObject() {
      raycaster.setFromCamera(mouse, activeCamera);
      var intersects = raycaster.intersectObjects(activeScene.children, true);
      if (intersects.length > 0) {
        // Check object type
        var candidate = null;
        if (pickType === null) {
          return;
        } else if (pickType === 'model') {
          candidate = getPickedModel(intersects);
          if (candidate === null) return;
        }

        // Update picked
        if (picked !== null) {
          highlightObject(picked, false);
          if (picked === candidate) {
            picked = null;
          } else {
            picked = candidate;
            highlightObject(picked, true);
          }
        } else {
          picked = candidate;
          highlightObject(picked, true);
        }
      }

      // Broadcast
      if (picked !== null)
        $rootScope.$broadcast('scene.picked', picked);
    }

    // Set highlight
    function highlightObject(object, enable) {
      if (angular.isUndefined(object.material) && angular.isDefined(object.children)) {
        object.children.forEach(function(child) {
          highlightObject(child, enable);
        });
      } else {
        if (angular.isUndefined(object.material.emissive))
          object.material.emissive = new $window.THREE.Color(0x000000);
        if (enable) {
          object.material.emissive.setHex(pickedColor);
        } else {
          object.material.emissive.setHex(0x000000);
        }
      }
    }

    // Check model
    function getPickedModel(intersects) {
      // Check input data
      if (intersects.length === 0) return;

      // Find candidate
      var candidate = null;
      for (i = 0; i < intersects.length; i++) {
        if (intersects[i].object instanceof $window.THREE.Mesh) {
          candidate = intersects[i].object.parent.parent;
          if (angular.isDefined(candidate.type) && candidate.type === 'model') break;
          candidate = null;
        }
      }

      // Return picked
      return candidate;
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
      // Orbitor
      if (orbitor !== null) orbitor.update();
      activeCamera.target.copy(orbitor.target);

      // Transformer
      if (transformer !== null) transformer.update();

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
      var geometry = new $window.THREE.SphereGeometry(1, 32, 32);
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

    // Crate camera helper
    function createCameraHelper(position, target) {
    }
  }
]);
