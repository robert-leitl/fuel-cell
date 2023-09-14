out vec3 vModelPosition;
out vec2 vUv;

void main() {
    vModelPosition = position;
    vUv = uv;
    gl_Position = vec4(uv * 2. - 1., 0., 1.);
}


