import * as THREE from 'three';
import {resizeRendererToDisplaySize} from '../libs/three-utils';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { ArcballControl } from '../libs/arcball-control';

// the target duration of one frame in milliseconds
const TARGET_FRAME_DURATION_MS = 16;

// total time
let time = 0;

// duration between the previous and the current animation frame
let deltaTimeMS = 0;

// total framecount according to the target frame duration
let frames = 0;

// relative frames according to the target frame duration (1 = 60 fps)
// gets smaller with higher framerates --> use to adapt animation timing
let deltaFrames = 0;

const settings = {
}

// module variables
let _isDev,
    _pane,
    _isInitialized = false,
    camera,
    scene,
    renderer,
    controls,
    glbScene,
    hdrEquiMap,
    viewportSize;

function init(canvas, onInit = null, isDev = false, pane = null) {
    _isDev = isDev;
    _pane = pane;

    if (pane) {
    }

    const manager = new THREE.LoadingManager();

    const objLoader = new GLTFLoader(manager);
    objLoader.load((new URL('../assets/model.glb', import.meta.url)).toString(), (gltf) => {
        glbScene = (gltf.scene)
    }, null, console.log);

    hdrEquiMap = new RGBELoader(manager)
        .load((new URL('../assets/env03.hdr', import.meta.url)).toString())

    manager.onLoad = () => {
        setupScene(canvas);

        if (onInit) onInit(this);

        renderer.setAnimationLoop((t) => run(t));

        resize();
    }
}

function setupScene(canvas) {
    camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, .2, .4);
    camera.position.set(0, 0.02, 0.31);
    camera.lookAt(new THREE.Vector3());

    scene = new THREE.Scene();
    glbScene.scale.multiplyScalar(0.03);
    scene.add(glbScene);

    renderer = new THREE.WebGLRenderer( { canvas, antialias: true } );
    renderer.sortObjects = true;
    renderer.useLegacyLights = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    THREE.ColorManagement.enabled = true;
    document.body.appendChild( renderer.domElement );
    viewportSize = new THREE.Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight);

    const pmremGenerator = new THREE.PMREMGenerator( renderer );
    pmremGenerator.compileEquirectangularShader();

    hdrEquiMap.colorSpace = THREE.LinearSRGBColorSpace;
    hdrEquiMap.mapping = THREE.EquirectangularReflectionMapping;
    const hdrEquiMapRT = pmremGenerator.fromEquirectangular(hdrEquiMap);
    hdrEquiMapRT.colorSpace = THREE.LinearSRGBColorSpace;

    controls = new ArcballControl(renderer.domElement);

    scene.environment = hdrEquiMapRT.texture;

    _isInitialized = true;
}

function run(t = 0) {
    deltaTimeMS = Math.min(TARGET_FRAME_DURATION_MS, t - time);
    time = t;
    deltaFrames = deltaTimeMS / TARGET_FRAME_DURATION_MS;
    frames += deltaFrames;

    animate();
    render();
}

function resize() {
    if (!_isInitialized) return;

    if (resizeRendererToDisplaySize(renderer)) {
        renderer.getSize(viewportSize);
        camera.aspect = viewportSize.x / viewportSize.y;
        camera.updateProjectionMatrix();
    }
}

function animate() {
    if (controls) {
        controls.update(deltaTimeMS);
        scene.quaternion.copy(controls.orientation);
    }
}

function render() {
    renderer.render( scene, camera );
}

export default {
    init,
    run,
    resize
}
