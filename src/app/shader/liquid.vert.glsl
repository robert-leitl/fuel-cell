out vec3 vModelPosition;
out vec3 vWorldPosition;

void main() {
    vModelPosition = position;
    vWorldPosition = (modelMatrix * vec4( position, 1.0 )).xyz;
}