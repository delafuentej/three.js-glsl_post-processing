 uniform sampler2D tDiffuse;
 uniform float uTime;
  
varying vec2 vUv;

void main(){

    vec2 newUv =vec2(
        vUv.x,
        vUv.y + sin(vUv.x * 10. + uTime) * 0.1
    );
    
        newUv.y += 0.5;
        vec4 color = texture2D(tDiffuse, newUv);
        
        
        gl_FragColor = color;
}