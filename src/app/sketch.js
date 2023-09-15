import * as THREE from 'three';
import {resizeRendererToDisplaySize} from '../libs/three-utils';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { ArcballControl } from '../libs/arcball-control';

import liquidVert from './shader/liquid.vert.glsl';
import liquidFrag from './shader/liquid.frag.glsl';
import glassVert from './shader/glass.vert.glsl';
import glassFrag from './shader/glass.frag.glsl';
import glassMistVert from './shader/glass-mist.vert.glsl';
import glassMistFrag from './shader/glass-mist.frag.glsl';
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
    levelValue: 0.5
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
    glassMaterial,
    glassBumpMap,
    iceBumpMap,
    glassThicknessMap,
    viewportSize;

let plane, soq, surfacePlane = new THREE.Vector4(),
 levelNormal = new THREE.Vector3(0, 1, 0), liqBounds = new THREE.Box3(), smoothLevelValue = 0;

let rtIndex, glassMistRTs, glassMistMaterial;

let smokeTex, smokeMeshes, smokeGroup;

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
        .load((new URL('../assets/env04.hdr', import.meta.url)).toString())

    iceBumpMap = new THREE.TextureLoader(manager)
        .load((new URL('../assets/bump.jpg', import.meta.url)).toString())

    glassBumpMap = new THREE.TextureLoader(manager)
        .load((new URL('../assets/height.jpg', import.meta.url)).toString())

    glassThicknessMap = new THREE.TextureLoader(manager)
        .load((new URL('../assets/thickness.png', import.meta.url)).toString())

    smokeTex = new THREE.TextureLoader(manager)
        .load((new URL('../assets/smoke.png', import.meta.url)).toString())

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
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.;
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
            uSurfacePlane: { value: surfacePlane },
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
        specularIntensity: 0.2,
        side: THREE.DoubleSide
    });
    liquidMesh.material = liquidMaterial;

    THREE.ShaderChunk.normal_fragment_begin = 
        `
        ${THREE.ShaderChunk.normal_fragment_begin}
        
        #ifdef IS_LIQUID
            if (!gl_FrontFacing) {
                normal = surfaceNormal;
                geometryNormal = normal;
            }
        #endif
        `;

    glassMaterial = new CustomShaderMaterial({
        baseMaterial: THREE.MeshPhysicalMaterial,
        vertexShader: glassVert,
        fragmentShader: glassFrag,
        silent: true, // Disables the default warning if true
        uniforms: {
            uGlassMist: { value: null }
        },
        defines: {
            'PHYSICAL': '',
            'IS_GLASS': ''
        },
        envMap: hdrEquiMapRT.texture,
        roughness: 1.5,
        transmission: 1,
        iridescence: 0,
        thickness: .02,
        thicknessMap: glassThicknessMap,
        bumpScale: .0003,
        transparent: true,
        specularIntensity: 0.5,
        reflectivity: 0.5
    });
    glassMesh.material = glassMaterial;
    glassMesh.layers.enable(5);

    THREE.ShaderChunk.transmission_fragment = THREE.ShaderChunk.transmission_fragment.replace(
        'material.transmission = transmission;',
        `
        material.transmission = transmission;
        #ifdef IS_GLASS
            material.transmission = 1. - glassMist.g * 0.3;
        #endif
        `
    );

    THREE.ShaderChunk.bumpmap_pars_fragment = THREE.ShaderChunk.bumpmap_pars_fragment.replace(
        'float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x',
        'float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).z'
    );
    THREE.ShaderChunk.bumpmap_pars_fragment = THREE.ShaderChunk.bumpmap_pars_fragment.replace(
        'float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;',
        'float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).z - Hll;'
    );
    THREE.ShaderChunk.bumpmap_pars_fragment = THREE.ShaderChunk.bumpmap_pars_fragment.replace(
        'float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;',
        'float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).z - Hll;'
    );

    glassMistMaterial = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: glassMistVert,
        fragmentShader: glassMistFrag,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        uniforms: {
            uIceBump: { value: iceBumpMap },
            uGlassBump: { value: glassBumpMap },
            uColor: { value: null },
            uSurfacePlane: { value: surfacePlane },
            uDims: { value: liqBounds.getSize(new THREE.Vector3())}
        }
    });

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

    soq = new SecondOrderSystemQuaternion(1.8, 0.5, 1, [0, 0, 0, 1]);

    glassMistRTs = [
        new THREE.WebGLRenderTarget(1024, 1024, {depthBuffer: false, type: THREE.HalfFloatType, format: THREE.RGBAFormat, internalFormat: 'RGBA16F', magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter}),
        new THREE.WebGLRenderTarget(1024, 1024, {depthBuffer: false, type: THREE.HalfFloatType, format: THREE.RGBAFormat, internalFormat: 'RGBA16F', magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter})
    ];
    rtIndex = 0;


    const smokeMaterial = new THREE.MeshLambertMaterial({
        map: smokeTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor
    });
    smokeGroup = new THREE.Group();
    scene.add(smokeGroup);
    smokeMeshes = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(0.4, 0.4),
        smokeMaterial,
        5
    );
    for(let i=0; i<smokeMeshes.count; ++i) {
        const m = new THREE.Matrix4();
        smokeMeshes.getMatrixAt(i, m);

        m.makeRotationZ(Math.random() * Math.PI * 2)
        m.multiply(
            new THREE.Matrix4().makeTranslation(new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                0
            ).multiplyScalar(.07)));
        
            smokeMeshes.setMatrixAt(i, m);
    }
    smokeGroup.add(smokeMeshes);


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
        levelNormal.copy(n);

        let levelValue = settings.levelValue;
        smoothLevelValue += (levelValue - smoothLevelValue) / 10;
        let w = (n.dot(new THREE.Vector3(0, 1, 0)));
        w = 1 - w * w;
        w = (0.5 - smoothLevelValue) * w;
        levelValue = smoothLevelValue + w * 0.7;
        levelValue = liqBounds.min.y + levelValue * (liqBounds.max.y - liqBounds.min.y);

        surfacePlane.set(levelNormal.x, levelNormal.y, levelNormal.z, -levelValue);

        const v = new THREE.Vector3(0, liqBounds.min.y, 0);
        v.applyQuaternion(lq);
        liquidMaterial.uniforms.uGroundLevelOffset.value.copy(v);


        for(let i=0; i<smokeMeshes.count; ++i) {
            const m = new THREE.Matrix4();
            smokeMeshes.getMatrixAt(i, m);
    
            m.multiply(
                new THREE.Matrix4().makeRotationZ(0.0005 * (i > smokeMeshes.count / 2 ? -i : i))
            );
            
            smokeMeshes.setMatrixAt(i, m);
        }
        smokeMeshes.instanceMatrix.needsUpdate = true;
    }
}

function render() {

    const rt = glassMistRTs[rtIndex];
    renderer.setRenderTarget(rt);
    rtIndex = (rtIndex + 1) % 2;
    glassMistMaterial.uniforms.uColor.value = glassMistRTs[rtIndex].texture;
    camera.layers.set(5);
    glassMesh.material = glassMistMaterial;
    renderer.render( scene, camera );
    glassMesh.material = glassMaterial;
    glassMaterial.roughnessMap = rt.texture;
    glassMaterial.bumpMap = rt.texture;
    glassMaterial.specularIntensityMap = rt.texture;
    glassMaterial.uniforms.uGlassMist.value = rt.texture;
    glassMesh.material.needsUpdate = true;
    camera.layers.set(0);

    renderer.setRenderTarget(null);
    renderer.render( scene, camera );
}

export default {
    init,
    run,
    resize
}
