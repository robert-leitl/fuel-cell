uniform sampler2D uGlassMist;

in vec3 vModelPosition;
in vec2 vUv;

void main(void) {
  vec4 glassMist = texture(uGlassMist, vUv);
  csm_DiffuseColor = vec4(vec3(1.), 1.);
}
