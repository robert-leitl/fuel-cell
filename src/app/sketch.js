import * as THREE from 'three';
import {resizeRendererToDisplaySize} from '../libs/three-utils';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { ArcballControl } from '../libs/arcball-control';

import liquidVert from './shader/liquid.vert.glsl';
import liquidFrag from './shader/liquid.frag.glsl';
import { SecondOrderSystemQuaternion } from './util/second-order-quaternion';

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
    levelValue: 0.3
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
    glassMesh,
    liquidMesh,
    liquidMaterial,
    viewportSize;

let plane, soq, level = new THREE.Vector3(0, 1, 0), liqBounds = new THREE.Box3(), smoothLevelValue = 0;



function init(canvas, onInit = null, isDev = false, pane = null) {
    _isDev = isDev;
    _pane = pane;

    if (pane) {
        pane.addBinding(settings, 'levelValue', {
            min: 0.1,
            max: 1,
          });
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
    camera.position.set(0, 0.04, 0.31);
    camera.lookAt(new THREE.Vector3());

    scene = new THREE.Scene();
    scene.add(glbScene);
    liquidMesh = glbScene.getObjectByName('liquid');
    glassMesh = glbScene.getObjectByName('glass');

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


    liquidMesh.geometry.computeBoundingBox();
    liqBounds = liquidMesh.geometry.boundingBox;


    liquidMaterial = new CustomShaderMaterial({
        baseMaterial: THREE.MeshPhysicalMaterial,
        vertexShader: liquidVert,
        fragmentShader: liquidFrag,
        silent: true, // Disables the default warning if true
        uniforms: {
            uLevel: { value: level },
            uGroundLevelOffset: { value: new THREE.Vector3() },
            uDims: { value: liqBounds.getSize(new THREE.Vector3())}
        },
        defines: {
            'PHYSICAL': '',
            'IS_LIQUID': ''
        },
        envMap: hdrEquiMapRT.texture,
        color: 0x0000ff,
        roughness: 0.,
        //transmission: 0.5,
        //thickness: 30,
        //ior: 1.3,
        //transparent: true,
        specularIntensity: 0.1,
        side: THREE.DoubleSide
    });
    liquidMesh.material = liquidMaterial;

    THREE.ShaderChunk.normal_fragment_begin = 
        `
        ${THREE.ShaderChunk.normal_fragment_begin}
        
        #ifdef IS_LIQUID
            if (!gl_FrontFacing) {
                normal = normalize(uLevel);
                normal.xy -= length(modelPos.xy * 10.) * attenuation;
                geometryNormal = normal;
            }
        #endif
        `;

        glassMesh.material.thickness = .009;
        glassMesh.material.specularIntensity = 0.1;
        glassMesh.material.roughness = 0.;
        glassMesh.material.transmission = 1;
    //glassMesh.visible = false;

    //scene.add(new THREE.AxesHelper());

    const planeGeo = new THREE.PlaneGeometry(3.08, 3.08);
    const angle = Math.PI / 2;
    const axis = new THREE.Vector3(Math.sin(angle / 2), 0, 0);
    planeGeo.applyQuaternion((new THREE.Quaternion(axis.x, axis.y, axis.z, Math.cos(angle/2))));
    plane = new THREE.Mesh(
        planeGeo,
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide})
    );

    soq = new SecondOrderSystemQuaternion(.8, 0.6, 1, [0, 0, 0, 1]);

    _isInitialized = true;
}

function run(t = 0) {
    deltaTimeMS = Math.max(0.001, Math.min(TARGET_FRAME_DURATION_MS, t - time));
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
        glbScene.quaternion.copy(controls.orientation);

        const qi = controls.orientation.clone();
        qi.invert();
        soq.updateApprox(deltaTimeMS * 0.001, qi.toArray([]));
        plane.quaternion.fromArray(soq.value);


        let lq = new THREE.Quaternion().fromArray(soq.value);
        const n = new THREE.Vector3(0, 1, 0).applyQuaternion(lq);

        let levelValue = settings.levelValue;
        smoothLevelValue += (levelValue - smoothLevelValue) / 10;

        let w = (n.dot(new THREE.Vector3(0, 1, 0)));
        w = 1 - w * w;
        w = (0.5 - smoothLevelValue) * w;
        levelValue = smoothLevelValue + w * 0.7;


        levelValue = levelValue * (liqBounds.max.y - liqBounds.min.y);
        n.multiplyScalar(levelValue);
        level.copy(n);
        

        const v = new THREE.Vector3(0, liqBounds.min.y, 0);
        v.applyQuaternion(lq);
        liquidMaterial.uniforms.uGroundLevelOffset.value.copy(v);

    }
}

function render() {
    /*renderer.clear();
    renderer.autoClear = false;
    liquidMesh.material.side = THREE.BackSide;
    renderer.render( scene, camera );
    liquidMesh.material.side = THREE.FrontSide;*/
    renderer.render( scene, camera );
}

export default {
    init,
    run,
    resize
}
