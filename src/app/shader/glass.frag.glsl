in vec3 vModelPosition;
in vec2 vUv;

void main(void) {
  csm_DiffuseColor = vec4(vUv, 0., 1.);
}
