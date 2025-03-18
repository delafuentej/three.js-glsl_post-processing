import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { DotScreenPass } from 'three/examples/jsm/postprocessing/DotScreenPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TextureLoader } from 'three/src/loaders/TextureLoader.js';
import tintVertexShader from './shaders/tint/vertex.glsl';
import tintFragmentShader from './shaders/tint/fragment.glsl';
import displacementVertexShader from './shaders/displacement/vertex.glsl';
import displacementeFragmentShader from './shaders/displacement/fragment.glsl';
// import distorsionVertexShader from './shaders/distorsion/vertex.glsl';
// import distorsionFragmentShader from './shaders/distorsion/fragment.glsl';


import GUI from 'lil-gui';



/**
 * POST-PROCESSING: Adding effects(passes in three.js) on the final image. We cann add multiple effects(passes), but we need to create another RENDER TARGET for each pass(effect).
 * -depth of field,-reflections, - refractions,  -bloom, -glitch effect, -color correction/variations, -vignette, -film grain, -god rays, -lens flare, -motion blur, -SSAO, -SSR, -tonemapping, -volumetric lighting,...etc
 * Instead of rendering in the canvas, we do it in a RENDER TARGET (in three.js), or buffer, or buffer texture, render-buffer,  buffer-render in other lybraries; (it is like rendering in a texture to be used later), so we are going to add effect in the fragment  shader 
 * 
 * We use the render target(TEXTURE) on a plane facing the camera and then covering the whole view
 * Using a special fragment shader that will apply the post-processing effect on the texture
 * We are going to use a class named EffectComposer  that does all this process in a simplified way for us.
 * EffectComposer Class
 * We need at first a RenderPass that will just take the scene, do a render & put it inside th RenderTarget
 */
/**
 * Base
 */
// Debug
const gui = new GUI();

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

/**
 * Loaders
 */
const gltfLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();
const textureLoader = new TextureLoader();

/**
 * Update all materials
 */
const updateAllMaterials = () =>
{
    scene.traverse((child) =>
    {
        if(child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial)
        {
            child.material.envMapIntensity = 2.5;
            child.material.needsUpdate = true;
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}

/**
 * Environment map
 */


const loadEnvironmentMap = async () => {
    try {
        const environmentMap = await new Promise((resolve, reject) => {
            rgbeLoader.setDataType(THREE.FloatType).load(
                './textures/environmentMaps/cockpit.hdr',
                resolve,
                undefined,
                reject
            );
        });

        environmentMap.mapping = THREE.EquirectangularReflectionMapping;
        
        scene.background = environmentMap;
        scene.environment = environmentMap;

    } catch (error) {
        console.error('Error loading environment map:', error);
    }
};

loadEnvironmentMap();
/**
 * Models
 */
gltfLoader.load(
    '/models/DamagedHelmet/glTF/DamagedHelmet.gltf',
    (gltf) =>
    {
        gltf.scene.scale.set(4, 4, 4);
        gltf.scene.rotation.y = Math.PI * 0.5;
        gltf.scene.position.y = - 1;
        scene.add(gltf.scene);

        updateAllMaterials();
    }
);

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight('#ffffff', 3);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.normalBias = 0.05;
directionalLight.position.set(0.25, 3, - 2.25);
scene.add(directionalLight);

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Update effect composer
    effectComposer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    effectComposer.setSize(sizes.width, sizes.height);
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.set(4, 1, - 4);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
 renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace
// renderer.toneMapping = THREE.ReinhardToneMapping
renderer.toneMappingExposure = 1.0;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));


/**
 * Post-Processing
 */
//Line 175: a)
// Note: this does not work on modern browser. So we need to do the step b)   
const renderTarget = new THREE.WebGLRenderTarget(
    800, 
    600,
    //to reactivate the antialias:
    {
       samples: (renderer.getPixelRatio() === 1) ? 2 : 0,
    }

);

//const effectComposer = new EffectComposer(renderer);
const effectComposer = new EffectComposer(renderer, renderTarget);
// set in it the pixel ratio & resize it:
effectComposer.setPixelRatio(Math.min(window.devicePixelRatio,2));
effectComposer.setSize(sizes.width, sizes.height);
// we need our RenderPass:
const renderPass = new RenderPass(scene, camera);

effectComposer.addPass(renderPass);

//first pass: dotScreenPass
const dotScreenPass = new DotScreenPass();
dotScreenPass.enabled = false;
effectComposer.addPass(dotScreenPass);

// second pass:  glitchPass
const glitchPass = new GlitchPass();
// some properties:
glitchPass.goWild = false;
glitchPass.enabled = false;
effectComposer.addPass(glitchPass);

// third pass: rgbShiftPass this is only available as a shader
const rgbShiftPass = new ShaderPass(RGBShiftShader);
rgbShiftPass.enabled = false;
effectComposer.addPass(rgbShiftPass);

// fourth pass: UnrealBloomPass
const unrealBloomPass = new UnrealBloomPass();
unrealBloomPass.strength = 0.3;
unrealBloomPass.radius = 1;
unrealBloomPass.threshold = 0.6;
effectComposer.addPass(unrealBloomPass);

gui.add(unrealBloomPass, 'enabled').name('Unreal Bloom');
gui.add(unrealBloomPass, 'strength').min(0).max(2).step(0.001);
gui.add(unrealBloomPass, 'radius').min(0).max(2).step(0.001);
gui.add(unrealBloomPass, 'threshold').min(0).max(1).step(0.001);

/**
 * Custom Passes
 */
//1. Tint Pass
const TintShader = { 
    uniforms: {
        tDiffuse: new THREE.Uniform(null),
        uTint: new THREE.Uniform(null)
    },
    vertexShader: tintVertexShader,
    fragmentShader: tintFragmentShader
};
const tintPass = new ShaderPass(TintShader);
tintPass.material.uniforms.uTint.value = new THREE.Vector3();
effectComposer.addPass(tintPass);

gui.add(tintPass.material.uniforms.uTint.value, 'x').min(-1).max(1).step(0.001).name('red-x');
gui.add(tintPass.material.uniforms.uTint.value, 'y').min(-1).max(1).step(0.001).name('green-y');
gui.add(tintPass.material.uniforms.uTint.value, 'z').min(-1).max(1).step(0.001).name('blue-z');

//2. Displacement Pass(make the things wave)..effect to be drunk, to be sick

// const DisplacementeShader = { 
//     uniforms: {
//         tDiffuse: new THREE.Uniform(null),
//         uTime: new THREE.Uniform(0)
//     },
//     vertexShader: distorsionVertexShader,
//     fragmentShader: distorsionFragmentShader
// };
// const displacementePass = new ShaderPass(DisplacementeShader);
// displacementePass.material.uniforms.uTime.value = 0;
// effectComposer.addPass(displacementePass);

const DisplacementeShader = { 
    uniforms: {
        tDiffuse: new THREE.Uniform(null),
        uNormalMap: new THREE.Uniform(null)
    },
    vertexShader:displacementVertexShader,
    fragmentShader: displacementeFragmentShader
};
const displacementePass = new ShaderPass(DisplacementeShader);
displacementePass.material.uniforms.uNormalMap.value = textureLoader.load('/textures/interfaceNormalMap.png');
effectComposer.addPass(displacementePass);

// to be able to fix this effect, because EffectComposer does not support the encoding

// we can add a pass that wil fix the color :GammaCorrectionShader and it wil converter the linear encoding to a sRGB encondig:
const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
gammaCorrectionPass.enabled = true;
effectComposer.addPass(gammaCorrectionPass);

// to fix the issue antialiasing with post-processing we can use a combination of a) renderTarget: providing our own RenderTarget on wich we add the antialias
//and (line 175) b) using a pass to do the anitalias but with lesser performance and a slightly different result


// to know if the browser supports webGl2 we can use the following code:
if(renderer. getPixelRatio() === 1 && !renderer.capabilities.isWebGL2){

//b) SMAA pass
    const smaaPass = new SMAAPass();
    effectComposer.addPass(smaaPass);
    

}


/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime();

    //update passes
   // displacementePass.material.uniforms.uTime.value = elapsedTime


    // Update controls
    controls.update();



    // Render
    //renderer.render(scene, camera);
    effectComposer.render();

    // Call tick again on the next frame
    window.requestAnimationFrame(tick);
}

tick();