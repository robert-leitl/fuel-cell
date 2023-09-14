uniform sampler2D uColor;
uniform vec4 uSurfacePlane;
uniform vec3 uDims;

in vec3 vModelPosition;
in vec2 vUv;

layout(location = 0) out vec4 outColor;

float sdPlane( vec3 p, vec3 n, float h )
{
  // n must be normalized
  return dot(p,n) + h;
}

void main() {
    vec3 modelPos = vModelPosition;
    float levelDist = sdPlane(modelPos, uSurfacePlane.xyz, uSurfacePlane.w + 0.00001) / uDims.x;
    levelDist *= -1.;
    levelDist = max(0., levelDist);

    float prevValue = texture(uColor, vUv).r;
    float value = prevValue + (levelDist - prevValue) * 0.02;
    
    outColor = vec4(value);
}
